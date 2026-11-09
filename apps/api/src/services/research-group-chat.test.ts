import { describe, expect, it } from "vitest";
import { planResearchGroupChat, type GroupChatMember } from "./research-group-chat";

const member = (userId: string, projectRole: string, extra: Partial<GroupChatMember> = {}): GroupChatMember => ({
  userId,
  projectRole,
  leftAt: null,
  name: userId.toUpperCase(),
  active: true,
  ...extra,
});
const research = { id: "r1", title: "CampusWay", groupName: "Research Group B" };

describe("planResearchGroupChat", () => {
  it("adds groupmates directly and invites the adviser", () => {
    const plan = planResearchGroupChat({
      requesterId: "s1",
      research,
      members: [member("s1", "LEADER"), member("s2", "MEMBER"), member("s3", "MEMBER"), member("a1", "ADVISER")],
      existingChatId: null,
    });
    expect(plan).toEqual({
      ok: true,
      title: "Research Group B",
      studentIds: ["s2", "s3"],
      adviserIds: ["a1"],
      adviserName: "A1",
    });
  });

  it("refuses anyone who is not a current student member", () => {
    const members = [member("s1", "LEADER"), member("s2", "MEMBER", { leftAt: new Date() }), member("a1", "ADVISER")];
    expect(planResearchGroupChat({ requesterId: "s2", research, members, existingChatId: null })).toMatchObject({ ok: false, status: 403 });
    expect(planResearchGroupChat({ requesterId: "a1", research, members, existingChatId: null })).toMatchObject({ ok: false, status: 403 });
    expect(planResearchGroupChat({ requesterId: "outsider", research, members, existingChatId: null })).toMatchObject({ ok: false, status: 403 });
  });

  it("allows only one chat per group", () => {
    const plan = planResearchGroupChat({
      requesterId: "s1",
      research,
      members: [member("s1", "LEADER"), member("s2", "MEMBER")],
      existingChatId: "chat-1",
    });
    expect(plan).toMatchObject({ ok: false, status: 409 });
  });

  it("leaves out former and inactive members and panelists", () => {
    const plan = planResearchGroupChat({
      requesterId: "s1",
      research,
      members: [
        member("s1", "LEADER"),
        member("s2", "MEMBER", { leftAt: new Date() }),
        member("s3", "MEMBER", { active: false }),
        member("p1", "PANELIST"),
        member("a1", "ADVISER", { leftAt: new Date() }),
      ],
      existingChatId: null,
    });
    expect(plan).toMatchObject({ ok: false, status: 400 });
  });

  it("falls back to the research title when the group has no name", () => {
    const plan = planResearchGroupChat({
      requesterId: "s1",
      research: { ...research, groupName: null },
      members: [member("s1", "LEADER"), member("s2", "MEMBER")],
      existingChatId: null,
    });
    expect(plan).toMatchObject({ ok: true, title: "CampusWay", adviserIds: [], adviserName: null });
  });
});
