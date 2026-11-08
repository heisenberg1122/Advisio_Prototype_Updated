/**
 * Rules for a researcher starting their own research group's chat.
 *
 * - Only an active student member (LEADER or MEMBER) of the group may start it.
 * - A group has at most one such chat.
 * - Every other active student member is added directly; active advisers are
 *   invited and must accept. Nobody outside the group can be added.
 */
export type GroupChatMember = {
  userId: string;
  projectRole: string;
  leftAt: Date | null;
  name: string;
  active: boolean;
};

export type GroupChatPlan =
  | { ok: false; status: 403 | 409 | 400; error: string }
  | {
      ok: true;
      title: string;
      studentIds: string[];
      adviserIds: string[];
      adviserName: string | null;
    };

const STUDENT_ROLES = new Set(["LEADER", "MEMBER"]);

export function planResearchGroupChat(input: {
  requesterId: string;
  research: { id: string; title: string; groupName: string | null };
  members: GroupChatMember[];
  existingChatId: string | null;
}): GroupChatPlan {
  const current = input.members.filter((member) => !member.leftAt && member.active);
  const requesterIsStudent = current.some(
    (member) => member.userId === input.requesterId && STUDENT_ROLES.has(member.projectRole),
  );
  if (!requesterIsStudent)
    return { ok: false, status: 403, error: "Only a member of this research group can start its chat" };
  if (input.existingChatId)
    return { ok: false, status: 409, error: "This research group already has a chat" };

  const unique = (ids: string[]) => [...new Set(ids)];
  const studentIds = unique(
    current
      .filter((member) => STUDENT_ROLES.has(member.projectRole) && member.userId !== input.requesterId)
      .map((member) => member.userId),
  );
  const advisers = current.filter((member) => member.projectRole === "ADVISER" && member.userId !== input.requesterId);
  const adviserIds = unique(advisers.map((member) => member.userId)).filter((id) => !studentIds.includes(id));
  if (!studentIds.length && !adviserIds.length)
    return { ok: false, status: 400, error: "Your group needs at least one other member or an adviser to start a chat" };

  const name = (input.research.groupName || "").trim() || input.research.title.trim() || "Research group";
  return {
    ok: true,
    title: name.slice(0, 200),
    studentIds,
    adviserIds,
    adviserName: advisers[0]?.name || null,
  };
}
