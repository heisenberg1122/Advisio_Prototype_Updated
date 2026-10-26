import { createHash } from "node:crypto";
import type { Prisma } from "../lib/prisma.js";
import { emailNotification } from "./notification-email.service.js";

export async function inviteTeamMember(
  tx: Prisma.TransactionClient,
  input: {
    kind: "project" | "workspace";
    id: string;
    actorId: string;
    actorName: string;
    email: unknown;
  },
) {
  const fail = (message: string, statusCode = 403): never => {
    throw Object.assign(new Error(message), { statusCode });
  };
  if (!/^[0-9a-f-]{36}$/i.test(input.id)) fail("Invalid team ID.", 400);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.id}))`;
  const project =
    input.kind === "project"
      ? await tx.researchProject.findUnique({
          where: { id: input.id },
          include: { members: { where: { leftAt: null } } },
        })
      : null;
  const workspace =
    input.kind === "workspace"
      ? await tx.researchWorkspace.findUnique({
          where: { id: input.id },
          include: { members: { where: { leftAt: null } } },
        })
      : null;
  const team = project || workspace;
  if (!team) return fail("Team not found.", 404);
  const leader = project
    ? project.members.some(
        (member) =>
          member.userId === input.actorId && member.projectRole === "LEADER",
      )
    : workspace!.members.some(
        (member) => member.userId === input.actorId && member.role === "LEADER",
      );
  if (!leader) fail("Only the active team leader can send team invitations.");
  if (
    team.participationMode !== "GROUP" ||
    !team.inviteCodeEnabled ||
    !team.inviteCode
  )
    fail("Enable group invitation codes before inviting a researcher.", 409);
  if (
    project &&
    (["ARCHIVED", "COMPLETED", "REJECTED"].includes(project.status) ||
      (project.inviteCodeExpiresAt &&
        project.inviteCodeExpiresAt <= new Date()))
  )
    fail("This project invitation is no longer active.", 409);
  if (
    workspace &&
    (await tx.researchProject.count({
      where: { workspaceId: workspace.id, status: { not: "ARCHIVED" } },
    }))
  )
    fail("Use the registered project's invitation instead.", 409);
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const recipient = email
    ? await tx.user.findFirst({
        where: {
          email,
          status: "ACTIVE",
          collegeId: team.collegeId,
          programId: team.programId,
          roles: { some: { role: { name: "RESEARCHER" } } },
        },
        select: { id: true },
      })
    : null;
  if (!recipient)
    return fail(
      "Choose an active registered researcher in your academic program.",
      400,
    );
  if (team.members.some((member) => member.userId === recipient.id))
    fail("This researcher is already a team member.", 409);
  return queueTeamInvitation(tx, {
    recipientId: recipient.id,
    actorId: input.actorId,
    actorName: input.actorName,
    teamId: input.id,
    teamName: project ? project.groupName || project.title : workspace!.name,
    code: team.inviteCode!,
  });
}

export async function queueTeamInvitation(
  tx: Prisma.TransactionClient,
  input: {
    recipientId: string;
    actorId: string;
    actorName: string;
    teamId: string;
    teamName: string;
    code: string;
  },
) {
  const day = new Date().toISOString().slice(0, 10);
  const deduplicationKey = createHash("sha256")
    .update(
      `team-invite:${input.teamId}:${input.recipientId}:${input.code}:${day}`,
    )
    .digest("hex");
  return tx.notification.createMany({
    skipDuplicates: true,
    data: [
      {
        recipientId: input.recipientId,
        audience: "researcher",
        type: "WORKFLOW_CHANGED",
        title: "Team workspace invitation",
        message: `${input.actorName} invited you to join ${input.teamName}.`,
        entityType: "TEAM_INVITATION",
        entityId: input.teamId,
        actionUrl: `/join-group?code=${encodeURIComponent(input.code)}`,
        deduplicationKey,
        ...emailNotification("team_invitation", {
          actorName: input.actorName,
          actorId: input.actorId,
          teamName: input.teamName,
        }),
      },
    ],
  });
}

export async function queueTeamJoined(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    actorName: string;
    teamId: string;
    teamName: string;
    leaderIds: string[];
  },
) {
  const invitations = await tx.notification.findMany({
    where: {
      recipientId: input.userId,
      entityType: "TEAM_INVITATION",
      entityId: input.teamId,
    },
    select: { emailData: true },
  });
  const recipients = new Set(input.leaderIds);
  for (const invitation of invitations) {
    const actorId = (invitation.emailData as Record<string, unknown> | null)
      ?.actorId;
    if (typeof actorId === "string") recipients.add(actorId);
  }
  recipients.delete(input.userId);
  if (!recipients.size) return;
  await tx.notification.createMany({
    skipDuplicates: true,
    data: [...recipients].map((recipientId) => ({
      recipientId,
      audience: "researcher",
      type: "WORKFLOW_CHANGED" as const,
      title: "A researcher joined your team",
      message: `${input.actorName} joined ${input.teamName}.`,
      entityType: "TEAM_MEMBERSHIP",
      entityId: input.teamId,
      actionUrl: "/student/dashboard?tab=my-group",
      deduplicationKey: `team-joined:${input.teamId}:${input.userId}:${recipientId}`,
      ...emailNotification("team_joined", {
        actorName: input.actorName,
        teamName: input.teamName,
      }),
    })),
  });
}
