import { prisma, type Prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import type { MonitoringQuery } from "../schemas/dean-monitoring.schema.js";
import type {
  DefenseRow,
  DefenseResponse,
} from "@research-management/shared/src/dean-monitoring";
import {
  dateBounds,
  deanCollege,
  defenseStageName,
  defenseStageWhere,
  monitoringError,
  monitoringScope,
  projectWhere,
  TIMEZONE,
} from "./dean-monitoring-scope.js";
import { hasSignedDefenseApproval } from "./defense-eligibility.service.js";

// Deliberately exclude scores, answers, private notes, document storage keys and evaluation PDFs.
export const deanSessionSelect = {
  id: true,
  researchId: true,
  status: true,
  scheduledStart: true,
  scheduledEnd: true,
  startedAt: true,
  endedAt: true,
  venue: true,
  meetingUrl: true,
  releasedAt: true,
  decision: true,
  revisionClearance: true,
  eligibility: {
    select: {
      id: true,
      deanApprovalDocumentId: true,
      milestone: { select: { id: true, name: true } },
    },
  },
  defenseEvent: { select: { defenseType: true } },
  research: {
    select: {
      title: true,
      groupName: true,
      program: { select: { code: true } },
      academicYear: { select: { name: true } },
      members: {
        where: { leftAt: null, projectRole: "ADVISER" },
        select: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  },
  invitations: {
    where: { status: { not: "REMOVED" } },
    select: {
      inviteeId: true,
      role: true,
      status: true,
      isRequired: true,
      invitee: { select: { firstName: true, lastName: true } },
    },
  },
  packet: {
    select: { status: true, evaluationMode: true, manuscriptVersionId: true },
  },
  evaluations: { where: { status: "LOCKED" }, select: { evaluatorId: true } },
  structuredEvaluations: {
    where: { lockedAt: { not: null } },
    select: { panelistId: true },
  },
  pdfEvaluations: { where: { status: "LOCKED" }, select: { panelistId: true } },
} satisfies Prisma.DefenseSessionSelect;
type Session = Prisma.DefenseSessionGetPayload<{
  select: typeof deanSessionSelect;
}>;
const panelRole = (role: string) =>
  role === "PANELIST" || role === "PANEL_CHAIR";
const terminal = (status: string) =>
  status === "COMPLETED" || status === "CANCELLED";
export function defenseRow(
  s: Session,
  user: Pick<AuthenticatedUser, "id" | "roles">,
  now = new Date(),
): DefenseRow {
  const panel = s.invitations.filter(
    (i) => panelRole(i.role) && i.status !== "REMOVED",
  );
  const required = panel.filter((i) => i.isRequired);
  const accepted = required.filter((i) => i.status === "ACCEPTED");
  const submitted = new Set(
    s.packet?.evaluationMode === "STRUCTURED"
      ? s.structuredEvaluations.map((e) => e.panelistId)
      : s.packet?.evaluationMode === "PDF"
        ? s.pdfEvaluations.map((e) => e.panelistId)
        : s.evaluations.map((e) => e.evaluatorId),
  );
  const pending = required.filter((i) =>
    ["PENDING", "RECONFIRMATION_REQUIRED"].includes(i.status),
  ).length;
  const evaluationCount = accepted.filter((i) =>
    submitted.has(i.inviteeId),
  ).length;
  const published = s.packet?.status === "PUBLISHED";
  const needsRevisions = Boolean(
    s.releasedAt &&
    ["APPROVED_WITH_MINOR_REVISIONS", "MAJOR_REVISIONS_REQUIRED"].includes(
      s.decision || "",
    ),
  );
  // Clearance data is an internal JSON record. Expose only its state, never arbitrary fields.
  const clearance = s.revisionClearance as { clearedAt?: unknown } | null;
  const cleared =
    typeof clearance?.clearedAt === "string" &&
    !Number.isNaN(Date.parse(clearance.clearedAt));
  const attention: string[] = [];
  if (s.status !== "CANCELLED") {
    if (!terminal(s.status)) {
      if (pending)
        attention.push(`${pending} required panel confirmation(s) pending`);
      if (required.some((i) => i.status === "DECLINED"))
        attention.push("Required panel invitation declined");
      if (
        s.invitations.some(
          (i) =>
            !panelRole(i.role) &&
            i.isRequired &&
            !["ACCEPTED", "REMOVED"].includes(i.status),
        )
      )
        attention.push("Required participant confirmation unresolved");
      if (
        !required.some((i) => i.role === "PANEL_CHAIR") ||
        !required.some((i) => i.role === "PANELIST")
      )
        attention.push("Required chair or panelist missing");
      if (s.status === "NEEDS_RESCHEDULING")
        attention.push("Schedule needs review");
      if (s.status === "SCHEDULED" && !published)
        attention.push("Defense packet not published");
      if (
        s.status === "SCHEDULED" &&
        s.eligibility &&
        !s.eligibility.deanApprovalDocumentId
      )
        attention.push("Dean approval letter not linked");
      if (s.scheduledStart && s.scheduledStart < now && !s.startedAt)
        attention.push("Scheduled start passed; defense not started");
      if (s.status === "LIVE") attention.push("Defense in progress");
      if (s.status === "DELIBERATION")
        attention.push("Deliberation in progress");
    }
    if (
      !s.releasedAt &&
      (s.endedAt || s.status === "COMPLETED") &&
      accepted.length > evaluationCount
    )
      attention.push(
        `${accepted.length - evaluationCount} final evaluation(s) pending`,
      );
    if (s.status === "COMPLETED" && !s.releasedAt)
      attention.push("Result release pending");
    if (needsRevisions && !cleared)
      attention.push("Revision clearance pending");
  }
  const mine = user.roles.includes("PANELIST")
    ? panel.find((i) => i.inviteeId === user.id)
    : undefined;
  return {
    id: s.id,
    researchId: s.researchId,
    title: s.research.title,
    groupName: s.research.groupName,
    program: s.research.program.code,
    academicYear: s.research.academicYear.name,
    stage:
      s.eligibility?.milestone.name ||
      defenseStageName(s.defenseEvent?.defenseType),
    cycle: s.eligibility
      ? `Eligibility ${s.eligibility.id.slice(0, 8)}`
      : "Not recorded",
    status: s.status,
    scheduledStart: s.scheduledStart?.toISOString() || null,
    scheduledEnd: s.scheduledEnd?.toISOString() || null,
    venue: s.venue,
    meetingUrl: /^https?:\/\//i.test(s.meetingUrl || "") ? s.meetingUrl : null,
    adviser:
      s.research.members
        .map((m) => `${m.user.firstName} ${m.user.lastName}`)
        .join(", ") || "Unassigned",
    panelAccepted: accepted.length,
    panelRequired: required.length,
    panel: s.invitations.map((i) => ({
      name: `${i.invitee.firstName} ${i.invitee.lastName}`,
      role: i.role,
      status: i.status,
      required: i.isRequired,
    })),
    preparation: published
      ? "Official defense packet published"
      : s.packet
        ? "Defense packet draft"
        : "Defense packet not recorded",
    evaluationsSubmitted: evaluationCount,
    evaluationsRequired: accepted.length,
    releasedAt: s.releasedAt?.toISOString() || null,
    decision: s.releasedAt ? s.decision : null,
    revisionStatus: needsRevisions
      ? cleared
        ? "Cleared"
        : "Pending clearance"
      : s.releasedAt
        ? "Not applicable"
        : "Result not released",
    attention,
    myAssignment: mine
      ? {
          status: mine.status,
          canEvaluate:
            mine.status === "ACCEPTED" &&
            s.status === "LIVE" &&
            published &&
            !submitted.has(mine.inviteeId),
        }
      : null,
  };
}
export async function deanDefenses(
  user: AuthenticatedUser,
  q: MonitoringQuery,
): Promise<DefenseResponse> {
  const collegeId = deanCollege(user, q.collegeId);
  if (
    q.researchTypeId ||
    q.status !== "all" ||
    q.availability !== "all" ||
    q.format
  )
    throw monitoringError(
      "These filters are not supported for defense oversight.",
    );
  const scope = await monitoringScope(collegeId, q, true);
  const now = new Date();
  const sessions = await prisma.defenseSession.findMany({
    where: {
      research: {
        ...projectWhere(collegeId, q),
        ...(q.search && {
          OR: [
            { title: { contains: q.search, mode: "insensitive" } },
            { groupName: { contains: q.search, mode: "insensitive" } },
          ],
        }),
      },
      ...defenseStageWhere(q),
      ...((q.from || q.to) && { scheduledStart: dateBounds(q) }),
    },
    select: deanSessionSelect,
    orderBy: [
      { scheduledStart: { sort: "asc", nulls: "last" } },
      { id: "asc" },
    ],
  });
  const all = sessions.map((s) => defenseRow(s, user, now));
  const upcoming = (r: DefenseRow) =>
    !terminal(r.status) &&
    Boolean(r.scheduledStart && new Date(r.scheduledStart) >= now);
  const filtered = all.filter((r) =>
    q.view === "upcoming"
      ? upcoming(r)
      : q.view === "attention"
        ? r.attention.length > 0
        : q.view === "completed"
          ? r.status === "COMPLETED"
          : r.status === "CANCELLED",
  );
  return {
    scope,
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    cards: {
      upcoming: all.filter(upcoming).length,
      awaitingPanel: all.filter(
        (r) =>
          !terminal(r.status) &&
          r.panel.some(
            (i) =>
              i.required &&
              panelRole(i.role) &&
              ["PENDING", "RECONFIRMATION_REQUIRED"].includes(i.status),
          ),
      ).length,
      rescheduling: all.filter((r) => r.status === "NEEDS_RESCHEDULING").length,
      awaitingRelease: all.filter(
        (r) => r.status === "COMPLETED" && !r.releasedAt,
      ).length,
    },
    rows: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    total: filtered.length,
    page: q.page,
    pageSize: q.pageSize,
    myAssignments: all.filter(
      (r) => r.myAssignment && r.status !== "CANCELLED",
    ),
  };
}
export async function deanDefenseDetails(user: AuthenticatedUser, id: string) {
  const collegeId = deanCollege(user);
  const session = await prisma.defenseSession.findFirst({
    where: { id, research: { collegeId } },
    select: deanSessionSelect,
  });
  if (!session)
    throw monitoringError("Defense not found in your college.", 404);
  const row = defenseRow(session, user);
  row.preparationChecks = [
    {
      label: "Defense eligibility",
      status: session.eligibility ? "Approved for this cycle" : "Not recorded",
    },
    {
      label: "Dean approval letter",
      status: !session.eligibility
        ? "Not recorded"
        : (await hasSignedDefenseApproval(
              prisma,
              session.eligibility.deanApprovalDocumentId,
            ))
          ? "Signed"
          : "Valid signature not recorded",
    },
    { label: "Manuscript and evaluation packet", status: row.preparation },
    {
      label: "Required panel confirmations",
      status: `${row.panelAccepted} of ${row.panelRequired} confirmed`,
    },
  ];
  if (
    session.releasedAt &&
    session.packet &&
    [
      "APPROVED_WITH_MINOR_REVISIONS",
      "MAJOR_REVISIONS_REQUIRED",
      "REDEFENSE_REQUIRED",
    ].includes(row.decision || "")
  ) {
    const event = await prisma.manuscriptStatusEvent.findFirst({
      where: {
        versionId: session.packet.manuscriptVersionId,
        toStatus: "REVISION_REQUIRED",
        metadata: { path: ["defenseSessionId"], equals: session.id },
      },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    if (event?.reason) row.revisionInstructions = event.reason;
  }
  return row;
}
