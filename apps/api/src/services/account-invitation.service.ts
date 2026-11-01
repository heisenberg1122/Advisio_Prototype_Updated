import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "@research-management/email";
import {
  acceptAccountInvitationSchema,
  inviteAccountSchema,
  invitationTokenSchema,
  reviewAccountInvitationSchema,
  type InviteAccountInput,
} from "@research-management/validations/account-invitations";
import { prisma, type Prisma, type AccountInvitation } from "../lib/prisma.js";
import { resolveCollegeAuthorization } from "../lib/college-authorization.js";

const lifetime = 48 * 60 * 60_000;
export const accountInvitationHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const roleLabels: Record<string, string> = {
  ADVISER: "Adviser",
  RESEARCH_COORDINATOR: "Professor Coordinator",
  PANELIST: "Panelist",
  DEAN: "Dean",
};
function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
function invalidLink(): never {
  fail(
    "This invitation is invalid, expired, revoked, or already accepted. Ask your administrator for a new invitation.",
    400,
  );
}
const escaped = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const accountInclude = {
  college: true,
  roles: { include: { role: true } },
  collegeMemberships: { include: { college: true } },
} as const;

function emailWebUrl() {
  const provider =
    process.env.EMAIL_PROVIDER ||
    (process.env.RESEND_API_KEY ? "resend" : "mock");
  const configured =
    provider === "gmail"
      ? [
          "GMAIL_CLIENT_ID",
          "GMAIL_CLIENT_SECRET",
          "GMAIL_REFRESH_TOKEN",
          "GMAIL_SENDER_EMAIL",
        ].every((key) => Boolean(process.env[key]?.trim()))
      : provider === "resend" &&
        Boolean(
          process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim(),
        );
  if (!configured || !process.env.WEB_URL)
    fail(
      "Invitation email is not configured. Configure Gmail or Resend and WEB_URL before sending invitations.",
      503,
    );
  try {
    const url = new URL(process.env.WEB_URL!);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    )
      throw new Error();
    return url;
  } catch {
    fail(
      "Invitation email requires a valid WEB_URL (HTTPS in production).",
      503,
    );
  }
}
async function issuer(
  tx: Prisma.TransactionClient,
  id: string,
  activeCollegeId?: string | null,
) {
  const account = await tx.user.findUnique({
    where: { id },
    include: accountInclude,
  });
  if (!account || account.status !== "ACTIVE")
    fail("Active administrator or dean access is required.", 403);
  if (account.roles.some(({ role }) => role.name === "SYSTEM_ADMIN"))
    return { administrator: true, collegeId: null };
  const context = resolveCollegeAuthorization(
    account,
    activeCollegeId || undefined,
  );
  if (!context.roles.includes("DEAN"))
    fail(
      "Only System Administrators and authorized college Deans can invite faculty.",
      403,
    );
  return { administrator: false, collegeId: context.collegeId };
}
async function assertAdministrator(tx: Prisma.TransactionClient, id: string) {
  if (!(await issuer(tx, id)).administrator)
    fail("System administrator access is required.", 403);
}
async function assertInvitationAuthority(
  tx: Prisma.TransactionClient,
  invitation: AccountInvitation,
) {
  const authority = await issuer(
    tx,
    invitation.createdById,
    invitation.collegeId,
  );
  if (!authority.administrator) {
    if (
      authority.collegeId !== invitation.collegeId ||
      invitation.roleNames.includes("DEAN")
    )
      fail("This invitation is no longer authorized.", 403);
    if (invitation.approvedById)
      await assertAdministrator(tx, invitation.approvedById);
    else {
      const recipient = await tx.user.findFirst({
        where: {
          OR: [
            { email: invitation.email },
            { universityId: invitation.universityId },
          ],
        },
        include: { collegeMemberships: true },
      });
      const additionalCollege =
        recipient &&
        recipient.collegeId !== invitation.collegeId &&
        !recipient.collegeMemberships.some(
          (membership) => membership.collegeId === invitation.collegeId,
        );
      if (
        additionalCollege ||
        invitation.roleNames.some((role) => role !== "ADVISER")
      )
        fail(
          "System Administrator approval is required. Submit a new college access request.",
          403,
        );
    }
  }
}
async function deliver(invitation: AccountInvitation, token: string) {
  const link = new URL("/accept-invitation", emailWebUrl());
  link.hash = new URLSearchParams({ token }).toString();
  const college = await prisma.college.findUniqueOrThrow({
    where: { id: invitation.collegeId },
  });
  const roles = invitation.roleNames.map((role) => roleLabels[role]).join(", ");
  const text = `Hello ${invitation.firstName},\nYou are invited to Advisio as ${roles} for ${college.name}.\nAccept within 48 hours: ${link.href}\nIf you already have an account, sign in to accept without changing your password. Otherwise, set your own password. This link can only be used once. If this was unexpected, contact your institution.`;
  let success = false;
  try {
    success = (
      await sendEmail({
        to: invitation.email,
        subject: "Your Advisio college access invitation",
        text,
        html: `<p>Hello ${escaped(invitation.firstName)},</p><p>You are invited to Advisio as <strong>${escaped(roles)}</strong> for ${escaped(college.name)}.</p><p><a href="${escaped(link.href)}">Accept invitation</a></p><p>This single-use link expires in 48 hours. Existing users sign in to accept using their current account. If unexpected, contact your institution.</p>`,
      })
    ).success;
  } catch {
    /* Do not log tokens or provider secrets. */
  }
  if (!success) {
    await prisma.accountInvitation.updateMany({
      where: {
        id: invitation.id,
        tokenHash: invitation.tokenHash,
        status: "PENDING",
      },
      data: { status: "DELIVERY_FAILED" },
    });
    fail(
      "The invitation email could not be sent. No account or access was created. Check email delivery and resend.",
      503,
    );
  }
  const changed = await prisma.accountInvitation.updateMany({
    where: {
      id: invitation.id,
      tokenHash: invitation.tokenHash,
      status: "PENDING",
    },
    data: { deliveredAt: new Date() },
  });
  if (!changed.count)
    fail("This invitation was revoked while sending. Send a new invitation.");
  return {
    message: "Invitation email sent. The link expires in 48 hours.",
    invitationId: invitation.id,
  };
}

export async function createAccountInvitation(
  raw: InviteAccountInput,
  actorId: string,
  activeCollegeId?: string | null,
) {
  const input = inviteAccountSchema.parse(raw);
  const token = randomBytes(32).toString("hex");
  const invitation = await prisma.$transaction(async (tx) => {
    const authority = await issuer(tx, actorId, activeCollegeId);
    if (
      !authority.administrator &&
      (authority.collegeId !== input.collegeId ||
        input.roleNames.includes("DEAN"))
    )
      fail(
        "Deans may request faculty access only for their own college and cannot appoint Deans.",
        403,
      );
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.email}:${input.collegeId}`}))`;
    const college = await tx.college.findFirst({
      where: { id: input.collegeId, isActive: true },
    });
    if (!college) fail("Select an active college or school.", 400);
    const existing = await tx.user.findFirst({
      where: {
        OR: [{ email: input.email }, { universityId: input.universityId }],
      },
      include: { collegeMemberships: true },
    });
    if (
      existing &&
      (existing.email.toLowerCase() !== input.email ||
        existing.universityId !== input.universityId)
    )
      fail(
        "The email and institutional ID do not identify the same account. Ask the System Administrator to verify these details.",
      );
    if (existing && existing.status !== "ACTIVE")
      fail(
        "This account must be verified or restored by the System Administrator before adding access.",
      );
    const crossCollege =
      existing &&
      existing.collegeId !== input.collegeId &&
      !existing.collegeMemberships.some(
        (membership) => membership.collegeId === input.collegeId,
      );
    const needsApproval =
      !authority.administrator &&
      (crossCollege || input.roleNames.some((role) => role !== "ADVISER"));
    if (!needsApproval) emailWebUrl();
    if (
      (await tx.role.count({ where: { name: { in: input.roleNames } } })) !==
      input.roleNames.length
    )
      fail("An invited role is unavailable.");
    if (
      await tx.accountInvitation.findFirst({
        where: {
          email: input.email,
          collegeId: input.collegeId,
          status: { in: ["PENDING", "AWAITING_APPROVAL"] },
        },
      })
    )
      fail(
        "An invitation or request is already open for this email and college. Use Resend, Revoke, or the approval queue.",
      );
    const created = await tx.accountInvitation.create({
      data: {
        email: input.email,
        universityId: input.universityId,
        firstName: input.firstName,
        lastName: input.lastName,
        roleNames: input.roleNames,
        collegeId: input.collegeId,
        createdById: actorId,
        verificationNote: input.verificationNote,
        tokenHash: accountInvitationHash(token),
        expiresAt: new Date(Date.now() + lifetime),
        status: needsApproval ? "AWAITING_APPROVAL" : "PENDING",
        lastSentAt: needsApproval ? null : new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "CREATE",
        entityType: "ACCOUNT_INVITATION",
        entityId: created.id,
        newValues: {
          email: input.email,
          roleNames: input.roleNames,
          collegeId: input.collegeId,
          verificationNote: input.verificationNote,
          status: created.status,
        },
      },
    });
    return created;
  });
  if (invitation.status === "AWAITING_APPROVAL")
    return {
      message:
        "Request submitted to the System Administrator. An invitation will be sent after approval.",
      invitationId: invitation.id,
    };
  return deliver(invitation, token);
}

async function usableInvitation(tx: Prisma.TransactionClient, token: string) {
  if (!invitationTokenSchema.safeParse({ token }).success) invalidLink();
  const invitation = await tx.accountInvitation.findUnique({
    where: { tokenHash: accountInvitationHash(token) },
    include: { college: true },
  });
  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    !invitation.deliveredAt ||
    invitation.expiresAt <= new Date() ||
    !invitation.college.isActive
  )
    invalidLink();
  await assertInvitationAuthority(tx, invitation);
  return invitation;
}
export async function previewAccountInvitation(token: string) {
  return prisma.$transaction(async (tx) => {
    const invitation = await usableInvitation(tx, token);
    const existing = await tx.user.findFirst({
      where: {
        OR: [
          { email: invitation.email },
          { universityId: invitation.universityId },
        ],
      },
      select: { id: true },
    });
    return {
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      roleNames: invitation.roleNames,
      collegeId: invitation.collegeId,
      collegeName: invitation.college.name,
      expiresAt: invitation.expiresAt,
      accountExists: Boolean(existing),
    };
  });
}
export async function acceptAccountInvitation(
  token: string,
  password?: string,
  existingUserId?: string,
) {
  if (existingUserId) invitationTokenSchema.parse({ token });
  else acceptAccountInvitationSchema.parse({ token, password });
  const passwordHash = existingUserId ? null : await bcrypt.hash(password!, 12);
  try {
    await prisma.$transaction(async (tx) => {
      const invitation = await usableInvitation(tx, token);
      // Serialize a person's acceptance across colleges without changing their existing account.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invitation.email.toLowerCase()}))`;
      const existing = await tx.user.findFirst({
        where: {
          OR: [
            { email: invitation.email },
            { universityId: invitation.universityId },
          ],
        },
      });
      if (
        existing &&
        (!existingUserId ||
          existing.id !== existingUserId ||
          existing.email.toLowerCase() !== invitation.email.toLowerCase() ||
          existing.universityId !== invitation.universityId ||
          existing.status !== "ACTIVE")
      )
        fail(
          "Sign in to the active account matching this invitation to accept its college access. Existing account credentials will not be changed.",
        );
      if (!existing && existingUserId)
        fail("This invitation belongs to a different account.", 403);
      const roles = await tx.role.findMany({
        where: { name: { in: invitation.roleNames } },
        select: { id: true },
      });
      if (roles.length !== invitation.roleNames.length)
        fail("An invited role is unavailable.");
      const claimed = await tx.accountInvitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash: accountInvitationHash(token),
          status: "PENDING",
          deliveredAt: { not: null },
          expiresAt: { gt: new Date() },
        },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (!claimed.count) invalidLink();
      const user =
        existing ||
        (await tx.user.create({
          data: {
            email: invitation.email,
            universityId: invitation.universityId,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            collegeId: invitation.collegeId,
            passwordHash,
            status: "ACTIVE",
          },
        }));
      const membership = await tx.collegeMembership.findUnique({
        where: {
          userId_collegeId: {
            userId: user.id,
            collegeId: invitation.collegeId,
          },
        },
      });
      const roleNames = [
        ...new Set([...(membership?.roleNames || []), ...invitation.roleNames]),
      ];
      await tx.collegeMembership.upsert({
        where: {
          userId_collegeId: {
            userId: user.id,
            collegeId: invitation.collegeId,
          },
        },
        create: {
          userId: user.id,
          collegeId: invitation.collegeId,
          roleNames,
          grantedById: invitation.approvedById || invitation.createdById,
        },
        update: {
          roleNames,
          grantedById: invitation.approvedById || invitation.createdById,
        },
      });
      await tx.userRole.createMany({
        data: roles.map(({ id }) => ({
          userId: user.id,
          roleId: id,
          grantedBy: invitation.approvedById || invitation.createdById,
        })),
        skipDuplicates: true,
      });
      await tx.facultyProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      await tx.auditLog.create({
        data: {
          userId: invitation.createdById,
          action: existing ? "ROLE_CHANGE" : "CREATE",
          entityType: "USER",
          entityId: user.id,
          newValues: {
            invitationId: invitation.id,
            roleNames: invitation.roleNames,
            collegeId: invitation.collegeId,
            acceptedByEmailOwner: true,
            approvedById: invitation.approvedById,
          },
        },
      });
    });
  } catch (error: any) {
    if (error.code === "P2002")
      fail(
        "An account now exists for these details. Sign in to that account to accept the invitation.",
      );
    throw error;
  }
  return {
    message: existingUserId
      ? "College access accepted. You can now switch to the approved college."
      : "Your account is ready. Sign in with your email and new password.",
  };
}
export async function resendAccountInvitation(
  id: string,
  actorId: string,
  activeCollegeId?: string | null,
) {
  emailWebUrl();
  const token = randomBytes(32).toString("hex");
  const invitation = await prisma.$transaction(async (tx) => {
    const authority = await issuer(tx, actorId, activeCollegeId);
    const current = await tx.accountInvitation.findUnique({ where: { id } });
    if (!current || !["PENDING", "DELIVERY_FAILED"].includes(current.status))
      fail("Only approved, unaccepted invitations can be resent.");
    if (
      !authority.administrator &&
      (current.createdById !== actorId ||
        current.collegeId !== authority.collegeId)
    )
      fail("You cannot resend this invitation.", 403);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${current.email}:${current.collegeId}`}))`;
    await assertInvitationAuthority(tx, current);
    const changed = await tx.accountInvitation.updateMany({
      where: {
        id,
        tokenHash: current.tokenHash,
        status: { in: ["PENDING", "DELIVERY_FAILED"] },
        OR: [
          { lastSentAt: null },
          { lastSentAt: { lt: new Date(Date.now() - 60_000) } },
        ],
      },
      data: {
        tokenHash: accountInvitationHash(token),
        status: "PENDING",
        deliveredAt: null,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + lifetime),
      },
    });
    if (!changed.count)
      fail(
        "Wait one minute before resending this invitation, or refresh its status.",
        429,
      );
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "UPDATE",
        entityType: "ACCOUNT_INVITATION",
        entityId: id,
        newValues: { resent: true },
      },
    });
    return tx.accountInvitation.findUniqueOrThrow({ where: { id } });
  });
  return deliver(invitation, token);
}
export async function revokeAccountInvitation(
  id: string,
  actorId: string,
  activeCollegeId?: string | null,
) {
  await prisma.$transaction(async (tx) => {
    const authority = await issuer(tx, actorId, activeCollegeId);
    const changed = await tx.accountInvitation.updateMany({
      where: {
        id,
        status: { in: ["PENDING", "AWAITING_APPROVAL", "DELIVERY_FAILED"] },
        ...(!authority.administrator
          ? { createdById: actorId, collegeId: authority.collegeId! }
          : {}),
      },
      data: { status: "REVOKED" },
    });
    if (!changed.count)
      fail(
        "This invitation is no longer pending or is outside your authority.",
      );
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "UPDATE",
        entityType: "ACCOUNT_INVITATION",
        entityId: id,
        newValues: { status: "REVOKED" },
      },
    });
  });
  return { message: "Invitation or request revoked. Its link cannot be used." };
}
export async function reviewAccountInvitation(
  id: string,
  actorId: string,
  raw: unknown,
  approve: boolean,
) {
  const input = reviewAccountInvitationSchema.parse(raw);
  if (approve) emailWebUrl();
  const token = randomBytes(32).toString("hex");
  const invitation = await prisma.$transaction(async (tx) => {
    await assertAdministrator(tx, actorId);
    const current = await tx.accountInvitation.findUnique({ where: { id } });
    if (!current || current.status !== "AWAITING_APPROVAL")
      fail("This request has already been reviewed.");
    await issuer(tx, current.createdById, current.collegeId);
    const changed = await tx.accountInvitation.updateMany({
      where: { id, status: "AWAITING_APPROVAL" },
      data: {
        status: approve ? "PENDING" : "REJECTED",
        approvedById: approve ? actorId : null,
        reviewedAt: new Date(),
        reviewNote: input.verificationNote,
        ...(approve
          ? {
              tokenHash: accountInvitationHash(token),
              lastSentAt: new Date(),
              expiresAt: new Date(Date.now() + lifetime),
            }
          : {}),
      },
    });
    if (!changed.count) fail("This request has already been reviewed.");
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "UPDATE",
        entityType: "ACCOUNT_INVITATION",
        entityId: id,
        newValues: {
          approved: approve,
          verificationNote: input.verificationNote,
        },
      },
    });
    return tx.accountInvitation.findUniqueOrThrow({ where: { id } });
  });
  return approve
    ? deliver(invitation, token)
    : { message: "Request rejected. No access was granted." };
}
