import { describe, expect, it, vi } from "vitest";
import {
  inviteTeamMember,
  queueTeamInvitation,
  queueTeamJoined,
} from "./team-email.service.js";
const id = "10000000-0000-4000-8000-000000000001";
describe("team email events", () => {
  it("allows only the active leader to invite an active researcher in the same program", async () => {
    const team = {
      id,
      name: "Team Alpha",
      members: [{ userId: "leader", role: "LEADER" }],
      collegeId: "college",
      programId: "program",
      participationMode: "GROUP",
      inviteCode: "ABC123",
      inviteCodeEnabled: true,
    };
    const tx: any = {
      $executeRaw: vi.fn(),
      researchWorkspace: { findUnique: vi.fn().mockResolvedValue(team) },
      researchProject: { count: vi.fn().mockResolvedValue(0) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: "researcher" }) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const input = {
      kind: "workspace" as const,
      id,
      actorId: "leader",
      actorName: "Maria",
      email: "student@gmail.com",
    };
    await expect(
      inviteTeamMember(tx, { ...input, actorId: "outsider" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    await inviteTeamMember(tx, input);
    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          collegeId: "college",
          programId: "program",
          status: "ACTIVE",
        }),
      }),
    );
    expect(tx.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            emailTemplate: "team_invitation",
            recipientId: "researcher",
            entityType: "TEAM_INVITATION",
            actionUrl: "/student/join-group?code=ABC123",
          }),
        ],
      }),
    );
  });
  it("encodes the invitation code in the canonical notification destination", async () => {
    const tx: any = {
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    await queueTeamInvitation(tx, {
      recipientId: "researcher",
      actorId: "leader",
      actorName: "Maria",
      teamId: id,
      teamName: "Team Alpha",
      code: "ABC+12&3?",
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            entityType: "TEAM_INVITATION",
            actionUrl: "/student/join-group?code=ABC%2B12%263%3F",
          }),
        ],
      }),
    );
  });
  it("notifies the inviter and current leaders once, excluding the joining user", async () => {
    const tx: any = {
      notification: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { emailData: { actorId: "leader" } },
            { emailData: { actorId: "inviter" } },
          ]),
        createMany: vi.fn(),
      },
    };
    await queueTeamJoined(tx, {
      userId: "joined",
      actorName: "Juan",
      teamId: id,
      teamName: "Team Alpha",
      leaderIds: ["leader", "joined"],
    });
    const recipients = tx.notification.createMany.mock.calls[0][0].data.map(
      (entry: any) => entry.recipientId,
    );
    expect(recipients).toEqual(["leader", "inviter"]);
  });
});
