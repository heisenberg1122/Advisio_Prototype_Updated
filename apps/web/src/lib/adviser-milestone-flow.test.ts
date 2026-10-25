import { describe, expect, it } from "vitest";

export interface TrackerStepState {
  number: number;
  title: string;
  state: "completed" | "current" | "pending" | "declined" | "withdrawn";
}

export function computeTrackerSteps(options: {
  status: "APPROVED" | "PENDING_ADVISER" | "DECLINED" | "NOT_STARTED" | string;
  latestRequestStatus?:
    | "PENDING"
    | "ACCEPTED"
    | "REJECTED"
    | "CANCELLED"
    | string
    | null;
}): TrackerStepState[] {
  const isApproved = options.status === "APPROVED";
  const isPending = options.status === "PENDING_ADVISER";
  const isDeclined = options.status === "DECLINED";
  const isWithdrawn =
    !isApproved && !isPending && options.latestRequestStatus === "CANCELLED";

  return [
    {
      number: 1,
      title: "Adviser Selection",
      state: isApproved || isPending || isDeclined ? "completed" : "current",
    },
    {
      number: 2,
      title: "Request Submitted",
      state:
        isApproved || isPending || isDeclined || isWithdrawn
          ? "completed"
          : "pending",
    },
    {
      number: 3,
      title: isDeclined
        ? "Request Declined"
        : isWithdrawn
          ? "Request Withdrawn"
          : "Adviser Acceptance",
      state: isApproved
        ? "completed"
        : isPending
          ? "current"
          : isDeclined
            ? "declined"
            : isWithdrawn
              ? "withdrawn"
              : "pending",
    },
    {
      number: 4,
      title: "Milestone Approved",
      state: isApproved ? "completed" : "pending",
    },
  ];
}

export function resolveLeaderActions(options: {
  status: string;
  isLeader: boolean;
  requestId?: string | null;
}) {
  return {
    canSelect:
      options.isLeader &&
      (options.status === "NOT_STARTED" || options.status === "DECLINED"),
    canWithdraw:
      options.isLeader &&
      options.status === "PENDING_ADVISER" &&
      Boolean(options.requestId),
    isApproved: options.status === "APPROVED",
    readOnlyMember: !options.isLeader,
  };
}

describe("adviser milestone student workflow states", () => {
  it("projects correct tracker steps for NOT_STARTED state", () => {
    const steps = computeTrackerSteps({ status: "NOT_STARTED" });
    expect(steps[0].state).toBe("current");
    expect(steps[1].state).toBe("pending");
    expect(steps[2].state).toBe("pending");
    expect(steps[3].state).toBe("pending");
  });

  it("projects correct tracker steps for PENDING_ADVISER state", () => {
    const steps = computeTrackerSteps({
      status: "PENDING_ADVISER",
      latestRequestStatus: "PENDING",
    });
    expect(steps[0].state).toBe("completed");
    expect(steps[1].state).toBe("completed");
    expect(steps[2].state).toBe("current");
    expect(steps[3].state).toBe("pending");
  });

  it("projects correct tracker steps for DECLINED state without showing false success", () => {
    const steps = computeTrackerSteps({
      status: "DECLINED",
      latestRequestStatus: "REJECTED",
    });
    expect(steps[0].state).toBe("completed");
    expect(steps[1].state).toBe("completed");
    expect(steps[2].state).toBe("declined");
    expect(steps[2].title).toBe("Request Declined");
    expect(steps[3].state).toBe("pending");
  });

  it("projects correct tracker steps for WITHDRAWN state", () => {
    const steps = computeTrackerSteps({
      status: "NOT_STARTED",
      latestRequestStatus: "CANCELLED",
    });
    expect(steps[0].state).toBe("current");
    expect(steps[1].state).toBe("completed");
    expect(steps[2].state).toBe("withdrawn");
    expect(steps[2].title).toBe("Request Withdrawn");
    expect(steps[3].state).toBe("pending");
  });

  it("projects all steps completed for APPROVED milestone", () => {
    const steps = computeTrackerSteps({
      status: "APPROVED",
      latestRequestStatus: "ACCEPTED",
    });
    expect(steps.every((s) => s.state === "completed")).toBe(true);
  });

  it("enforces leader-only actions and protects members from unauthorized mutations", () => {
    // Leader when pending
    const leaderPending = resolveLeaderActions({
      status: "PENDING_ADVISER",
      isLeader: true,
      requestId: "req-1",
    });
    expect(leaderPending.canWithdraw).toBe(true);
    expect(leaderPending.canSelect).toBe(false);
    expect(leaderPending.readOnlyMember).toBe(false);

    // Regular member when pending
    const memberPending = resolveLeaderActions({
      status: "PENDING_ADVISER",
      isLeader: false,
      requestId: "req-1",
    });
    expect(memberPending.canWithdraw).toBe(false);
    expect(memberPending.canSelect).toBe(false);
    expect(memberPending.readOnlyMember).toBe(true);

    // Leader when declined
    const leaderDeclined = resolveLeaderActions({
      status: "DECLINED",
      isLeader: true,
      requestId: "req-1",
    });
    expect(leaderDeclined.canSelect).toBe(true);
    expect(leaderDeclined.canWithdraw).toBe(false);

    // Member when declined
    const memberDeclined = resolveLeaderActions({
      status: "DECLINED",
      isLeader: false,
      requestId: "req-1",
    });
    expect(memberDeclined.canSelect).toBe(false);
    expect(memberDeclined.canWithdraw).toBe(false);
    expect(memberDeclined.readOnlyMember).toBe(true);

    // Once approved: no withdrawal and no re-selection
    const leaderApproved = resolveLeaderActions({
      status: "APPROVED",
      isLeader: true,
      requestId: "req-1",
    });
    expect(leaderApproved.canSelect).toBe(false);
    expect(leaderApproved.canWithdraw).toBe(false);
    expect(leaderApproved.isApproved).toBe(true);
  });
});
