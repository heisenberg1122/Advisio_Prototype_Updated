import { createHash } from "node:crypto";

export type Identity = {
  collegeId: string;
  programId: string;
  researchTypeId: string;
  academicYearId: string | null;
  workflowId: string;
};
export type ProjectEvidence = Omit<Identity, "workflowId"> & {
  id: string;
  cohortId: string | null;
  workspaceId: string | null;
  workflowInstanceId: string | null;
};
export type BackfillSnapshot = {
  projects: ProjectEvidence[];
  workspaces: {
    id: string;
    collegeId: string;
    programId: string;
    cohortId: string | null;
  }[];
  instances: {
    id: string;
    researchId: string;
    workflowId: string;
    workflowVersion: number;
    currentStageId: string | null;
  }[];
  workflows: {
    id: string;
    researchTypeId: string;
    name: string;
    createdBy: string;
    status: string;
  }[];
  stages: { id: string; workflowId: string }[];
  cohorts: (Omit<Identity, "workflowId"> & {
    workflowId: string | null;
    id: string;
    status: string;
  })[];
  cohortMembers: {
    id: string;
    cohortId: string;
    userId: string;
    status: string;
  }[];
  researchMembers: {
    id: string;
    researchId: string;
    userId: string;
    projectRole: string;
    leftAt: Date | null;
  }[];
  workspaceMembers: {
    id: string;
    workspaceId: string;
    userId: string;
    role: string;
    leftAt: Date | null;
  }[];
  enrollments: {
    id: string;
    workflowId: string;
    userId: string;
    status: string;
  }[];
  users: {
    id: string;
    collegeId: string | null;
    programId: string | null;
    status: string;
    roles: string[];
    academicYearId: string | null;
  }[];
  programs: { id: string; collegeId: string }[];
  researchTypes: { id: string; programId: string }[];
  years: { id: string; name: string }[];
};
export type Finding = {
  category: "AMBIGUOUS" | "CONFLICT" | "INSUFFICIENT_EVIDENCE";
  code: string;
  entityType: string;
  entityId: string;
  userId?: string;
};
export type BackfillAction =
  | {
      kind: "CREATE_COHORT";
      target: string;
      identity: Identity;
      name: string;
      createdBy: string;
      evidence: string[];
    }
  | {
      kind: "PROJECT_LINK_UPDATE" | "WORKSPACE_LINK_UPDATE";
      id: string;
      target: string;
      evidence: string[];
    }
  | {
      kind: "MEMBERSHIP_CREATE";
      userId: string;
      target: string;
      evidence: string[];
    };
export type BackfillGroup = { id: string; actions: BackfillAction[] };
export type BackfillPlan = {
  format: "advisio-legacy-cohort-backfill-v1";
  sourceHash: string;
  projectsInspected: number;
  counts: Record<string, number>;
  groups: BackfillGroup[];
  findings: Finding[];
};
const countKeys = [
  "ALREADY_MIGRATED",
  "SAFE_EXISTING_COHORT_MATCH",
  "SAFE_COHORT_CREATION_CANDIDATE",
  "PROJECT_LINK_UPDATE",
  "WORKSPACE_LINK_UPDATE",
  "MEMBERSHIP_CREATE",
  "MEMBERSHIP_ALREADY_EXISTS",
  "AMBIGUOUS",
  "CONFLICT",
  "INSUFFICIENT_EVIDENCE",
  "SKIPPED",
];
export function stableHash(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, canonical(entry)]),
      );
    return item;
  }
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
const identityKey = (
  i: Omit<Identity, "workflowId"> & { workflowId: string | null },
) =>
  [
    i.workflowId,
    i.collegeId,
    i.programId,
    i.researchTypeId,
    i.academicYearId,
  ].join(":");
const same = (
  a: Omit<Identity, "workflowId"> & { workflowId: string | null },
  b: Identity,
) => identityKey(a) === identityKey(b);

/** Pure: IDs and persisted relations only; never writes or uses the deprecated type pointer. */
export function planLegacyCohortBackfill(s: BackfillSnapshot): BackfillPlan {
  const findings: Finding[] = [],
    counts = Object.fromEntries(countKeys.map((key) => [key, 0]));
  const actions: BackfillAction[] = [];
  const byId = <T extends { id: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.id, row]));
  const instances = byId(s.instances),
    workflows = byId(s.workflows),
    workspaces = byId(s.workspaces),
    cohorts = byId(s.cohorts),
    users = byId(s.users);
  const identities = new Map<string, Identity>(),
    resolutions = new Map<string, string>(),
    blocked = new Set<string>();
  function issue(
    category: Finding["category"],
    code: string,
    entityType: string,
    entityId: string,
    userId?: string,
  ) {
    if (
      !findings.some(
        (f) =>
          f.code === code &&
          f.entityType === entityType &&
          f.entityId === entityId &&
          f.userId === userId,
      )
    )
      findings.push({
        category,
        code,
        entityType,
        entityId,
        ...(userId ? { userId } : {}),
      });
  }
  function reject(
    p: ProjectEvidence,
    category: Finding["category"],
    code: string,
  ) {
    blocked.add(p.id);
    issue(category, code, "ResearchProject", p.id);
  }
  function eligible(userId: string, i: Identity) {
    const user = users.get(userId);
    return Boolean(
      user &&
      user.status === "ACTIVE" &&
      user.roles.includes("RESEARCHER") &&
      user.collegeId === i.collegeId &&
      user.programId === i.programId,
    );
  }
  function projectPeople(p: ProjectEvidence) {
    return s.researchMembers
      .filter(
        (m) =>
          m.researchId === p.id &&
          !m.leftAt &&
          ["LEADER", "MEMBER"].includes(m.projectRole),
      )
      .map((m) => m.userId);
  }
  function workspacePeople(id: string) {
    return s.workspaceMembers
      .filter((m) => m.workspaceId === id && !m.leftAt)
      .map((m) => m.userId);
  }
  // Validate explicit links before considering matches or any creation.
  for (const p of s.projects) {
    if (!p.academicYearId || !s.years.some((y) => y.id === p.academicYearId)) {
      reject(p, "INSUFFICIENT_EVIDENCE", "MISSING_ACADEMIC_YEAR");
      continue;
    }
    if (
      !s.programs.some(
        (row) => row.id === p.programId && row.collegeId === p.collegeId,
      ) ||
      !s.researchTypes.some(
        (row) => row.id === p.researchTypeId && row.programId === p.programId,
      )
    ) {
      reject(p, "CONFLICT", "ACADEMIC_SCOPE_CONFLICT");
      continue;
    }
    const instance = p.workflowInstanceId
      ? instances.get(p.workflowInstanceId)
      : undefined;
    if (!instance) {
      reject(p, "INSUFFICIENT_EVIDENCE", "NO_PINNED_WORKFLOW");
      continue;
    }
    const workflow = workflows.get(instance.workflowId);
    if (
      instance.researchId !== p.id ||
      s.instances.some(
        (other) => other.researchId === p.id && other.id !== instance.id,
      ) ||
      !workflow ||
      workflow.researchTypeId !== p.researchTypeId ||
      instance.workflowVersion < 1 ||
      (instance.currentStageId &&
        !s.stages.some(
          (stage) =>
            stage.id === instance.currentStageId &&
            stage.workflowId === workflow.id,
        ))
    ) {
      reject(p, "CONFLICT", "PINNED_WORKFLOW_CONFLICT");
      continue;
    }
    const i: Identity = {
      collegeId: p.collegeId,
      programId: p.programId,
      researchTypeId: p.researchTypeId,
      academicYearId: p.academicYearId,
      workflowId: workflow.id,
    };
    identities.set(p.id, i);
    const workspace = p.workspaceId ? workspaces.get(p.workspaceId) : undefined;
    if (
      p.workspaceId &&
      (!workspace ||
        workspace.collegeId !== p.collegeId ||
        workspace.programId !== p.programId)
    ) {
      reject(p, "CONFLICT", "WORKSPACE_SCOPE_CONFLICT");
      continue;
    }
    if (
      p.cohortId &&
      workspace?.cohortId &&
      p.cohortId !== workspace.cohortId
    ) {
      reject(p, "CONFLICT", "PROJECT_WORKSPACE_COHORT_CONFLICT");
      continue;
    }
    if (
      (p.cohortId &&
        (!cohorts.has(p.cohortId) || !same(cohorts.get(p.cohortId)!, i))) ||
      (workspace?.cohortId &&
        (!cohorts.has(workspace.cohortId) ||
          !same(cohorts.get(workspace.cohortId)!, i)))
    ) {
      reject(p, "CONFLICT", "COHORT_LINK_CONFLICT");
      continue;
    }
    if (p.cohortId) {
      resolutions.set(p.id, p.cohortId);
      counts.ALREADY_MIGRATED++;
      continue;
    }
    const matches = s.cohorts.filter((c) => same(c, i));
    if (matches.length > 1) reject(p, "AMBIGUOUS", "AMBIGUOUS_EXISTING_COHORT");
    else if (matches.length === 1) {
      resolutions.set(p.id, matches[0].id);
      counts.SAFE_EXISTING_COHORT_MATCH++;
    }
  }
  // Reconstruct only a demonstrable single legacy container, never academic scope alone.
  const candidateKeys = new Set<string>();
  for (const p of s.projects) {
    if (blocked.has(p.id) || resolutions.has(p.id)) continue;
    const i = identities.get(p.id)!;
    const workflow = workflows.get(i.workflowId)!;
    const related = s.projects.filter((row) =>
      s.instances.some(
        (instance) =>
          instance.researchId === row.id &&
          instance.workflowId === i.workflowId,
      ),
    );
    const relatedIdentities = related.map((row) => identities.get(row.id));
    const creator = users.get(workflow.createdBy);
    if (
      !creator ||
      creator.status !== "ACTIVE" ||
      !creator.roles.includes("RESEARCH_COORDINATOR") ||
      creator.collegeId !== i.collegeId ||
      creator.programId !== i.programId
    ) {
      reject(p, "INSUFFICIENT_EVIDENCE", "INSUFFICIENT_CREATOR_EVIDENCE");
      continue;
    }
    if (
      relatedIdentities.some(
        (other) => other && other.academicYearId !== i.academicYearId,
      )
    ) {
      reject(p, "CONFLICT", "MULTIPLE_ACADEMIC_YEARS");
      continue;
    }
    if (
      !["PUBLISHED", "ARCHIVED"].includes(workflow.status) ||
      related.some(
        (row) =>
          blocked.has(row.id) ||
          !identities.has(row.id) ||
          !same(identities.get(row.id)!, i) ||
          row.cohortId,
      ) ||
      s.cohorts.some((c) => c.workflowId === i.workflowId) ||
      related.some(
        (row) =>
          row.workspaceId &&
          s.projects.some(
            (peer) =>
              peer.workspaceId === row.workspaceId &&
              !related.some((r) => r.id === peer.id),
          ),
      )
    ) {
      reject(
        p,
        "INSUFFICIENT_EVIDENCE",
        "INSUFFICIENT_LEGACY_CONTAINER_EVIDENCE",
      );
      continue;
    }
    const population = new Set(
      related.flatMap((row) => [
        ...projectPeople(row),
        ...(row.workspaceId ? workspacePeople(row.workspaceId) : []),
      ]),
    );
    const activeEnrollments = s.enrollments.filter(
      (e) => e.workflowId === i.workflowId && e.status === "ACTIVE",
    );
    const enrolled = new Set(activeEnrollments.map((e) => e.userId));
    if (
      !population.size ||
      !enrolled.size ||
      [...population].some((id) => !eligible(id, i) || !enrolled.has(id)) ||
      [...enrolled].some((id) => !population.has(id) || !eligible(id, i))
    ) {
      reject(p, "INSUFFICIENT_EVIDENCE", "UNRECONCILED_LEGACY_POPULATION");
      continue;
    }
    const key = `legacy:${identityKey(i)}`;
    resolutions.set(p.id, key);
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      counts.SAFE_COHORT_CREATION_CANDIDATE++;
      const year = s.years.find((y) => y.id === i.academicYearId)!;
      actions.push({
        kind: "CREATE_COHORT",
        target: key,
        identity: i,
        name: `${workflow.name.slice(0, 150 - ` — ${year.name} — Migrated`.length)} — ${year.name} — Migrated`,
        createdBy: workflow.createdBy,
        evidence: [
          "PINNED_WORKFLOW_CONTAINER",
          "EXACT_ACADEMIC_SCOPE_YEAR",
          "RECONCILED_ACTIVE_POPULATION",
          "IN_SCOPE_COORDINATOR_CREATOR",
        ],
      });
    }
  }
  for (const p of s.projects) {
    const target = resolutions.get(p.id);
    if (target && !p.cohortId)
      actions.push({
        kind: "PROJECT_LINK_UPDATE",
        id: p.id,
        target,
        evidence: [
          "PINNED_WORKFLOW",
          "EXACT_ACADEMIC_SCOPE_YEAR",
          "UNIQUE_COHORT_OR_PROVEN_LEGACY_CONTAINER",
        ],
      });
  }
  const safeWorkspaces = new Map<string, string>();
  for (const w of s.workspaces) {
    const projects = s.projects.filter((p) => p.workspaceId === w.id);
    if (!projects.length) {
      if (!w.cohortId)
        issue(
          "INSUFFICIENT_EVIDENCE",
          "WORKSPACE_WITHOUT_CASE_EVIDENCE",
          "ResearchWorkspace",
          w.id,
        );
      continue;
    }
    const targets = new Set(
      projects
        .map((p) => resolutions.get(p.id))
        .filter((id): id is string => Boolean(id)),
    );
    if (targets.size > 1) {
      issue(
        "CONFLICT",
        "WORKSPACE_MULTI_COHORT_CONFLICT",
        "ResearchWorkspace",
        w.id,
      );
      continue;
    }
    if (projects.some((p) => !resolutions.has(p.id))) {
      issue(
        "INSUFFICIENT_EVIDENCE",
        "UNRESOLVED_WORKSPACE_CASE",
        "ResearchWorkspace",
        w.id,
      );
      continue;
    }
    const target = [...targets][0];
    if (w.cohortId && w.cohortId !== target) {
      issue("CONFLICT", "COHORT_LINK_CONFLICT", "ResearchWorkspace", w.id);
      continue;
    }
    safeWorkspaces.set(w.id, target);
    if (!w.cohortId)
      actions.push({
        kind: "WORKSPACE_LINK_UPDATE",
        id: w.id,
        target,
        evidence: projects.map((p) => `ALL_CASES_RESOLVE:${p.id}`),
      });
  }
  const memberships = new Map<
    string,
    {
      target: string;
      userId: string;
      identity: Identity;
      evidence: Set<string>;
    }
  >();
  function participant(
    target: string,
    userId: string,
    i: Identity,
    evidence: string,
  ) {
    if (!eligible(userId, i)) {
      issue(
        "CONFLICT",
        "OUT_OF_SCOPE_RESEARCHER",
        "ResearchCohort",
        target,
        userId,
      );
      return;
    }
    const key = `${target}:${userId}`,
      entry = memberships.get(key) || {
        target,
        userId,
        identity: i,
        evidence: new Set<string>(),
      };
    entry.evidence.add(evidence);
    memberships.set(key, entry);
  }
  for (const p of s.projects) {
    const target = resolutions.get(p.id);
    if (!target) continue;
    const i = identities.get(p.id)!;
    for (const userId of projectPeople(p))
      participant(target, userId, i, `ACTIVE_RESEARCH_MEMBER:${p.id}`);
    if (p.workspaceId && safeWorkspaces.get(p.workspaceId) === target)
      for (const userId of workspacePeople(p.workspaceId))
        participant(
          target,
          userId,
          i,
          `ACTIVE_WORKSPACE_MEMBER:${p.workspaceId}`,
        );
  }
  for (const p of s.projects) {
    const target = resolutions.get(p.id);
    if (!target) continue;
    const i = identities.get(p.id)!;
    const relatedIdentities = s.projects
      .filter((row) =>
        s.instances.some(
          (instance) =>
            instance.researchId === row.id &&
            instance.workflowId === i.workflowId,
        ),
      )
      .map((row) => identities.get(row.id));
    const uniqueContainer =
      relatedIdentities.length > 0 &&
      relatedIdentities.every((other) => other && same(other, i)) &&
      s.cohorts
        .filter((c) => c.workflowId === i.workflowId)
        .every((c) => c.id === target);
    for (const e of s.enrollments.filter(
      (e) => e.workflowId === i.workflowId,
    )) {
      if (memberships.has(`${target}:${e.userId}`)) continue; // Independent membership evidence can survive revoked access.
      if (e.status !== "ACTIVE") {
        issue(
          "INSUFFICIENT_EVIDENCE",
          "NON_ACTIVE_ENROLLMENT_ONLY",
          "WorkflowEnrollment",
          e.id,
          e.userId,
        );
        continue;
      }
      const user = users.get(e.userId);
      const departed =
        s.researchMembers.some(
          (m) =>
            m.userId === e.userId &&
            m.leftAt &&
            s.projects.some(
              (row) =>
                row.id === m.researchId &&
                identities.get(row.id)?.workflowId === i.workflowId,
            ),
        ) ||
        s.workspaceMembers.some(
          (m) =>
            m.userId === e.userId &&
            m.leftAt &&
            s.projects.some(
              (row) =>
                row.workspaceId === m.workspaceId &&
                identities.get(row.id)?.workflowId === i.workflowId,
            ),
        );
      if (
        !uniqueContainer ||
        !user?.academicYearId ||
        user.academicYearId !== i.academicYearId ||
        departed
      ) {
        issue(
          "INSUFFICIENT_EVIDENCE",
          "INSUFFICIENT_ENROLLMENT_YEAR_OR_CONTAINER",
          "WorkflowEnrollment",
          e.id,
          e.userId,
        );
        continue;
      }
      participant(
        target,
        e.userId,
        i,
        `ACTIVE_ENROLLMENT_WITH_PROFILE_YEAR:${e.id}`,
      );
    }
  }
  for (const m of memberships.values()) {
    const current = s.cohortMembers.find(
      (row) => row.cohortId === m.target && row.userId === m.userId,
    );
    if (current?.status === "REMOVED") {
      issue(
        "CONFLICT",
        "REMOVED_MEMBERSHIP_CONFLICT",
        "ResearchCohortMember",
        current.id,
        m.userId,
      );
      continue;
    }
    if (current?.status === "ACTIVE") {
      counts.MEMBERSHIP_ALREADY_EXISTS++;
      continue;
    }
    if (
      [...memberships.values()].some(
        (other) =>
          other.userId === m.userId &&
          other.target !== m.target &&
          same(other.identity, m.identity),
      )
    ) {
      issue(
        "CONFLICT",
        "CONFLICTING_COHORT_PARTICIPATION",
        "ResearchCohort",
        m.target,
        m.userId,
      );
      continue;
    }
    if (
      current ||
      s.cohortMembers.some(
        (row) =>
          row.userId === m.userId &&
          row.status === "ACTIVE" &&
          row.cohortId !== m.target &&
          cohorts.has(row.cohortId) &&
          same(cohorts.get(row.cohortId)!, m.identity),
      )
    ) {
      issue(
        "CONFLICT",
        "CONFLICTING_COHORT_MEMBERSHIP",
        "ResearchCohort",
        m.target,
        m.userId,
      );
      continue;
    }
    actions.push({
      kind: "MEMBERSHIP_CREATE",
      target: m.target,
      userId: m.userId,
      evidence: [...m.evidence].sort(),
    });
  }
  // Actions sharing a cohort or a multi-case workspace commit as one cluster.
  const parent = new Map<string, string>();
  function root(key: string): string {
    const p = parent.get(key);
    if (!p) {
      parent.set(key, key);
      return key;
    }
    return p === key ? key : root(p);
  }
  for (const target of resolutions.values()) root(target);
  for (const w of s.workspaces) {
    const targets = [
      ...new Set(
        s.projects
          .filter((p) => p.workspaceId === w.id)
          .map((p) => resolutions.get(p.id))
          .filter((id): id is string => Boolean(id)),
      ),
    ].sort();
    for (const target of targets.slice(1))
      parent.set(root(target), root(targets[0]));
  }
  const grouped = new Map<string, BackfillAction[]>();
  for (const action of actions) {
    const id = root(action.target);
    grouped.set(id, [...(grouped.get(id) || []), action]);
    if (action.kind !== "CREATE_COHORT") counts[action.kind]++;
  }
  for (const finding of findings) {
    counts[finding.category]++;
    counts.SKIPPED++;
  }
  return {
    format: "advisio-legacy-cohort-backfill-v1",
    sourceHash: stableHash(s),
    projectsInspected: s.projects.length,
    counts,
    groups: [...grouped]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, group]) => ({
        id,
        actions: group.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        ),
      })),
    findings: findings.sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    ),
  };
}
