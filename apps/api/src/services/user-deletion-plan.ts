import crypto from "node:crypto";
import path from "node:path";
import { Prisma } from "../lib/prisma.js";

type Row = Record<string, unknown>;
type Model = (typeof Prisma.dmmf.datamodel.models)[number];
type Delegate = {
  findMany(args: {
    where: Row;
    select: Record<string, boolean>;
  }): Promise<Row[]>;
  deleteMany(args: { where: Row }): Promise<unknown>;
};
type Client = Record<string, Delegate>;
type Link = {
  model: string;
  fields: readonly string[];
  parent: string;
  references: readonly string[];
  setNull: boolean;
};
export type DeletionNode = { key: string; model: string; where: Row; row: Row };
export type UserDeletionPlan = {
  nodes: DeletionNode[];
  order: DeletionNode[];
  files: { fileId: string; provider: string; storagePath: string | null }[];
  preview: {
    token: string;
    totalRecords: number;
    files: number;
    affectedOtherUsers: number;
    records: { type: string; count: number }[];
  };
};

export class UserDeletionError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
  ) {
    super(message);
  }
}

// These identifiers predate Prisma relations. Keep them in the same deletion plan.
const legacyUserFields: Record<string, string[]> = {
  Document: ["createdBy"],
  DocumentVersion: ["uploadedBy"],
  WorkflowStageAttachment: ["uploadedBy"],
  ResearchJoinRequest: ["requesterId", "respondedBy"],
  ResearchTitleRevision: ["requestedBy", "reviewedBy"],
  Form: ["createdBy"],
  FormSubmission: ["submittedBy"],
  Consultation: ["createdBy"],
  ConsultationNote: ["authorId"],
  WorkflowAccessEntry: ["actorId", "decidedBy"],
};
const legacyChatFields: Record<string, string[]> = {
  ChatGroup: ["createdByAdviserId"],
  ChatMessage: ["senderId"],
  ChatInvitation: ["studentId", "invitedByAdviserId"],
};
export const storedFileFields: Record<string, string[]> = {
  Document: ["externalFileId", "liveExternalFileId"],
  DocumentVersion: ["googleDriveFileId", "storagePath"],
  WorkflowResource: ["googleDriveFileId", "storagePath"],
  WorkflowStageAttachment: ["googleDriveFileId", "storagePath"],
  GroupFile: ["externalFileId", "storagePath"],
  OfficialCopy: ["googleDriveFileId", "storagePath"],
  OfficialCopySignature: ["googleDriveFileId", "storagePath"],
  Certificate: ["fileId"],
};
const globalModels = new Set([
  "College",
  "Program",
  "ProgramMajor",
  "AcademicYear",
  "Role",
  "Permission",
  "ResearchType",
  "EvaluationTemplate",
  "EvaluationCriterion",
  "DashboardWidget",
  "RoleDashboardWidget",
  "DashboardConfig",
  "RolePermission",
  "StorageIntegration",
  "FileDeletionJob",
]);

function delegate(tx: Prisma.TransactionClient, name: string): Delegate {
  return (tx as unknown as Client)[name[0].toLowerCase() + name.slice(1)];
}
function primaryFields(model: Model): readonly string[] {
  const fields = model.fields
    .filter((field) => field.isId)
    .map((field) => field.name);
  return fields.length ? fields : model.primaryKey?.fields || [];
}
function identity(model: Model, row: Row): Row {
  const fields = primaryFields(model);
  if (!fields.length)
    throw new UserDeletionError(
      `Deletion is not configured for ${model.name}.`,
    );
  return Object.fromEntries(fields.map((name) => [name, row[name]]));
}
function nodeKey(model: Model, row: Row): string {
  return `${model.name}:${JSON.stringify(identity(model, row))}`;
}
function chunks<T>(items: T[], size = 200): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}
export function managedFileId(field: string, value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  // Never follow arbitrary URLs or delete a source document imported from outside Advisio.
  const id =
    field === "storagePath"
      ? value.match(/^(?:google-drive:\/\/|local:\/\/)([\w-]+)$/)?.[1] ||
        value.match(/(?:^|[\\/])(gdrive-[0-9a-f-]{36})-/i)?.[1]
      : value;
  return id && /^[\w-]{1,255}$/.test(id) ? id : null;
}

/** Build a row-level dependency closure; never disable or change foreign-key constraints. */
export async function buildUserDeletionPlan(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string; universityId: string },
): Promise<UserDeletionPlan> {
  const models = new Map(
    Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
  );
  const links: Link[] = [];
  for (const model of models.values()) {
    for (const field of model.fields) {
      if (!field.relationFromFields?.length) continue;
      const metadataOnly =
        model.name === "ChatParticipant" && field.name === "invitedBy";
      links.push({
        model: model.name,
        fields: field.relationFromFields,
        parent: field.type,
        references: field.relationToFields || [],
        setNull:
          field.relationOnDelete === "SetNull" &&
          (field.type !== "User" || metadataOnly),
      });
    }
    for (const field of legacyUserFields[model.name] || []) {
      links.push({
        model: model.name,
        fields: [field],
        parent: "User",
        references: ["id"],
        setNull: false,
      });
    }
  }
  // Legacy polymorphic references have no FK but must not become orphan records.
  for (const parent of [
    "User",
    "ResearchProject",
    "ResearchWorkspace",
    "Workflow",
    "Document",
    "DefenseSession",
  ]) {
    for (const model of ["StorageFolder", "Notification"]) {
      links.push({
        model,
        fields: ["entityId"],
        parent,
        references: ["id"],
        setNull: false,
      });
    }
  }
  links.push({
    model: "ChatGroup",
    fields: ["relatedResearchGroupId"],
    parent: "ResearchProject",
    references: ["id"],
    setNull: false,
  });
  const selectFor = (model: Model) => {
    const names = new Set([
      ...primaryFields(model),
      "updatedAt",
      "storageProvider",
      ...(storedFileFields[model.name] || []),
      ...(legacyUserFields[model.name] || []),
      ...(legacyChatFields[model.name] || []),
    ]);
    for (const link of links) {
      if (link.model === model.name)
        link.fields.forEach((name) => names.add(name));
      if (link.parent === model.name)
        link.references.forEach((name) => names.add(name));
    }
    if (model.name === "ResearchProject") names.add("workflowInstanceId");
    return Object.fromEntries(
      model.fields
        .filter((field) => field.kind !== "object" && names.has(field.name))
        .map((field) => [field.name, true]),
    );
  };
  const nodes = new Map<string, DeletionNode>();
  let pending: DeletionNode[] = [];
  const add = (name: string, rows: Row[]) => {
    const model = models.get(name)!;
    for (const row of rows) {
      const key = nodeKey(model, row);
      if (nodes.has(key)) continue;
      if (globalModels.has(name) || (name === "User" && row.id !== user.id)) {
        throw new UserDeletionError(
          `Deletion would affect an unrelated institutional record (${name}).`,
        );
      }
      if (nodes.size >= 50_000)
        throw new UserDeletionError(
          "This account has too many linked records for interactive deletion. Contact the system maintainer.",
        );
      const node = { key, model: name, where: identity(model, row), row };
      nodes.set(key, node);
      pending.push(node);
    }
  };
  const load = async (name: string, filters: Row[]) => {
    for (const batch of chunks(filters)) {
      add(
        name,
        await delegate(tx, name).findMany({
          where: { OR: batch },
          select: selectFor(models.get(name)!),
        }),
      );
    }
  };
  await load("User", [{ id: user.id }]);
  if (!nodes.size) throw new UserDeletionError("User not found", 404);
  for (const [model, fields] of Object.entries(legacyChatFields)) {
    await load(
      model,
      fields.map((field) => ({
        [field]: { in: [user.id, user.email, user.universityId] },
      })),
    );
  }
  while (pending.length) {
    const current = pending;
    pending = [];
    const grouped = new Map<string, DeletionNode[]>();
    for (const node of current)
      grouped.set(node.model, [...(grouped.get(node.model) || []), node]);
    for (const link of links) {
      const parents = grouped.get(link.parent);
      if (link.setNull || !parents?.length) continue;
      await load(
        link.model,
        parents.map(({ row }) =>
          Object.fromEntries(
            link.fields.map((field, i) => [field, row[link.references[i]]]),
          ),
        ),
      );
    }
    // A project's instance is exclusively owned by the project despite the FK pointing upwards.
    const instances = (grouped.get("ResearchProject") || [])
      .map(({ row }) => row.workflowInstanceId)
      .filter(Boolean);
    if (instances.length)
      await load(
        "WorkflowInstance",
        instances.map((id) => ({ id })),
      );
    // Remove an otherwise empty document rather than leave a broken manuscript shell.
    const documentIds = [
      ...new Set(
        (grouped.get("DocumentVersion") || []).map(({ row }) => row.documentId),
      ),
    ];
    for (const documentId of documentIds) {
      const versions = await delegate(tx, "DocumentVersion").findMany({
        where: { documentId },
        select: { id: true },
      });
      if (
        versions.length &&
        versions.every((row) =>
          nodes.has(nodeKey(models.get("DocumentVersion")!, row)),
        )
      ) {
        await load("Document", [{ id: documentId }]);
      }
    }
  }

  // Compute dependencies between actual rows, including self-referencing folder/copy chains.
  // Model-level ordering alone fails when two rows in the same table depend on each other.
  const parentsByReference = new Map<string, Map<string, DeletionNode>>();
  const dependents = new Map<string, Set<string>>();
  const parentsOf = new Map<string, Set<string>>();
  for (const link of links.filter((entry) => !entry.setNull)) {
    const signature = `${link.parent}:${link.references.join(",")}`;
    let index = parentsByReference.get(signature);
    if (!index) {
      index = new Map(
        [...nodes.values()]
          .filter((node) => node.model === link.parent)
          .map((node) => [
            JSON.stringify(link.references.map((field) => node.row[field])),
            node,
          ]),
      );
      parentsByReference.set(signature, index);
    }
    for (const child of nodes.values()) {
      if (
        child.model !== link.model ||
        link.fields.some((field) => child.row[field] == null)
      )
        continue;
      const parent = index.get(
        JSON.stringify(link.fields.map((field) => child.row[field])),
      );
      if (!parent || parent.key === child.key) continue;
      if (!dependents.has(parent.key)) dependents.set(parent.key, new Set());
      dependents.get(parent.key)!.add(child.key);
      if (!parentsOf.has(child.key)) parentsOf.set(child.key, new Set());
      parentsOf.get(child.key)!.add(parent.key);
    }
  }
  const ready = [...nodes.values()].filter(
    (node) => !dependents.get(node.key)?.size,
  );
  const order: DeletionNode[] = [];
  while (ready.length) {
    const node = ready.pop()!;
    order.push(node);
    for (const key of parentsOf.get(node.key) || []) {
      const remaining = dependents.get(key)!;
      remaining.delete(node.key);
      if (!remaining.size) ready.push(nodes.get(key)!);
    }
  }
  if (order.length !== nodes.size)
    throw new UserDeletionError(
      "Linked records contain a circular dependency. No data was deleted; contact the system maintainer.",
    );
  const files = new Map<
    string,
    { fileId: string; provider: string; storagePath: string | null }
  >();
  const counts = new Map<string, number>();
  const otherUsers = new Set<string>();
  for (const node of nodes.values()) {
    counts.set(node.model, (counts.get(node.model) || 0) + 1);
    const storagePath = node.row.storagePath;
    const provider =
      typeof storagePath === "string" && storagePath.startsWith("supabase://")
        ? "SUPABASE"
        : typeof storagePath === "string" &&
            path.isAbsolute(storagePath) &&
            !storagePath.match(/(?:^|[\\/])gdrive-[0-9a-f-]{36}-/i)
          ? "LOCAL"
          : node.row.storageProvider || "GOOGLE_DRIVE";
    if (
      (provider === "LOCAL" || provider === "SUPABASE") &&
      typeof storagePath === "string"
    ) {
      const fileId = `stored-${crypto.createHash("sha256").update(`${provider}:${storagePath}`).digest("hex")}`;
      files.set(fileId, { fileId, provider, storagePath });
    } else if (provider === "GOOGLE_DRIVE") {
      for (const field of storedFileFields[node.model] || []) {
        const id = managedFileId(field, node.row[field]);
        if (id && !id.startsWith("local-"))
          files.set(id, {
            fileId: id,
            provider: "GOOGLE_DRIVE",
            storagePath: null,
          });
      }
    }
    if (
      ["ResearchMember", "WorkspaceMember", "ChatParticipant"].includes(
        node.model,
      ) &&
      node.row.userId !== user.id
    ) {
      otherUsers.add(String(node.row.userId));
    }
  }
  const sorted = [...nodes.values()].sort((a, b) => a.key.localeCompare(b.key));
  const token = crypto
    .createHash("sha256")
    .update(JSON.stringify(sorted.map(({ key, row }) => ({ key, row }))))
    .digest("hex");
  return {
    nodes: [...nodes.values()],
    order,
    files: [...files.values()],
    preview: {
      token,
      totalRecords: nodes.size,
      files: files.size,
      affectedOtherUsers: otherUsers.size,
      records: [...counts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => ({ type, count })),
    },
  };
}

export async function executeUserDeletionPlan(
  tx: Prisma.TransactionClient,
  plan: UserDeletionPlan,
) {
  for (const node of plan.order)
    await delegate(tx, node.model).deleteMany({ where: node.where });
}
