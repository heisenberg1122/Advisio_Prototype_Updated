import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const delegate = () =>
    Object.fromEntries(
      [
        "findFirst",
        "findMany",
        "findUnique",
        "findUniqueOrThrow",
        "count",
        "create",
        "update",
        "updateMany",
        "upsert",
      ].map((method) => [method, vi.fn()]),
    );
  const result: any = Object.fromEntries(
    [
      "user",
      "role",
      "program",
      "college",
      "researchProject",
      "researchMember",
      "workflowEnrollment",
      "researchType",
      "defenseSession",
      "certificate",
      "review",
      "auditLog",
      "calendarEvent",
      "consultation",
      "mailThread",
      "documentVersion",
    ].map((model) => [model, delegate()]),
  );
  result.$transaction = vi.fn();
  result.$executeRaw = vi.fn();
  return result;
});
vi.mock("../lib/prisma.js", async () => ({
  ...(await vi.importActual("@prisma/client")),
  prisma: db,
}));
vi.mock("@research-management/email", () => ({ sendEmail: vi.fn() }));
import auth from "./auth.routes.js";
import research from "./research.routes.js";
import admin from "./admin.routes.js";
import calendar from "./calendar.routes.js";
import { assignResearchMember } from "../services/member-assignment.service.js";
import { changeAccountStatus } from "../services/account-status.service.js";
import { resolveRegistrationWorkflow } from "../services/registration-workflow.service.js";
import { getReleasedGradeReport } from "../services/grade-report.service.js";
import {
  resetPassword,
  recoveryTokenHash,
  requestPasswordRecovery,
} from "../services/password-recovery.service.js";
import { generateToken, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { googleCalendarService } from "../services/google-calendar.service.js";
import { serializeConsultation } from "../services/consultation.service.js";
import { getPermissionsForRoles } from "@research-management/auth";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { registerSchema } from "@research-management/validations";

const collegeId = "11111111-1111-4111-8111-111111111111";
const programId = "22222222-2222-4222-8222-222222222222";
const user = (roles = ["RESEARCHER"]): AuthenticatedUser => ({
  id: "user-a",
  email: "test@example.org",
  universityId: "AUDIT-1",
  roles: roles as any,
  permissions: getPermissionsForRoles(roles as any),
  collegeId,
  programId,
});
function handler(router: any, method: string, path: string, index = -1) {
  return router.stack
    .find(
      (layer: any) => layer.route?.path === path && layer.route.methods[method],
    )
    .route.stack.at(index).handle;
}
function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      JSON.stringify(body);
      this.body = body;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (operation: any) => operation(db));
  db.$executeRaw.mockResolvedValue(1);
  db.auditLog.create.mockResolvedValue({ id: "audit" });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("audit authorization regressions", () => {
  it("never provisions a missing account during login", async () => {
    vi.stubEnv("ALLOW_DEMO_ACCOUNT_PROVISIONING", "true");
    vi.stubEnv("DEMO_ACCOUNT_PASSWORD", "DevelopmentOnly123!");
    db.user.findUnique.mockResolvedValue(null);
    const res = response();

    await handler(
      auth,
      "post",
      "/login",
    )(
      {
        body: {
          email: "student01@university.edu.ph",
          password: "DevelopmentOnly123!",
        },
      },
      res,
    );

    expect(res.statusCode).toBe(401);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it.each([
    "admin@example.org",
    "faculty-admin@example.org",
    "admin01@university.edu.ph",
  ])("keeps public registration pending for %s", async (email) => {
    db.user.findFirst.mockResolvedValue(null);
    db.program.findFirst.mockResolvedValue({ id: programId, collegeId });
    db.role.findUnique.mockResolvedValue({ id: "researcher-role" });
    db.user.create.mockImplementation(async ({ data }: any) => ({
      id: "new-user",
      ...data,
    }));
    const res = response();
    const body = registerSchema.parse({
      email,
      universityId: "NEW-1",
      firstName: "Test",
      lastName: "Account",
      password: "Regression123!",
      programId,
      collegeId,
      role: "RESEARCHER",
    });
    await handler(auth, "post", "/register")({ body }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("PENDING");
    expect(res.body.token).toBeUndefined();
    expect(db.role.findUnique).toHaveBeenCalledWith({
      where: { name: "RESEARCHER" },
    });
    expect(db.user.create.mock.calls[0][0].data.roles.create.roleId).toBe(
      "researcher-role",
    );
  });

  it("blocks cross-college membership assignment before touching a roster", async () => {
    db.researchProject.findUnique.mockResolvedValue({
      collegeId: "other-college",
    });
    await expect(
      assignResearchMember(
        user(["RESEARCH_COORDINATOR"]),
        "project",
        "target",
        "LEADER",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.researchMember.upsert).not.toHaveBeenCalled();
  });

  it("blocks an unrelated same-college professor", async () => {
    db.researchProject.findUnique.mockResolvedValue({
      collegeId,
      programId,
      status: "DRAFT",
      workflowInstance: { workflow: { createdBy: "other-professor" } },
    });
    await expect(
      assignResearchMember(
        user(["RESEARCH_COORDINATOR"]),
        "project",
        "target",
        "ADVISER",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not use administrative assignment to bypass researcher invitations", async () => {
    db.researchProject.findUnique.mockResolvedValue({
      collegeId,
      programId,
      status: "DRAFT",
    });
    await expect(
      assignResearchMember(
        user(["SYSTEM_ADMIN"]),
        "project",
        "target",
        "LEADER",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects ineligible faculty and restores leftAt only for eligible assignments", async () => {
    db.researchProject.findUnique.mockResolvedValue({
      collegeId,
      programId,
      status: "DRAFT",
      workflowInstance: { workflow: { createdBy: "user-a" } },
    });
    db.user.findUnique.mockResolvedValueOnce({
      id: "target",
      collegeId,
      programId,
      status: "ACTIVE",
      roles: [{ role: { name: "RESEARCHER" } }],
    });
    await expect(
      assignResearchMember(
        user(["RESEARCH_COORDINATOR"]),
        "project",
        "target",
        "ADVISER",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    db.user.findUnique.mockResolvedValueOnce({
      id: "target",
      collegeId,
      programId,
      status: "ACTIVE",
      roles: [{ role: { name: "PANELIST" } }],
    });
    db.researchMember.upsert.mockResolvedValue({ id: "member" });
    await assignResearchMember(
      user(["RESEARCH_COORDINATOR"]),
      "project",
      "target",
      "PANELIST",
    );
    expect(db.researchMember.upsert.mock.calls[0][0].update).toEqual({
      leftAt: null,
    });
  });

  it("blocks researcher certificate issuance", async () => {
    db.researchProject.findUnique.mockResolvedValue({
      collegeId,
      status: "COMPLETED",
      members: [{ projectRole: "LEADER" }],
    });
    const res = response();
    await handler(
      admin,
      "post",
      "/certificates",
    )({ user: user(), body: { researchId: "project" } }, res);
    expect(res.statusCode).toBe(403);
    expect(db.certificate.create).not.toHaveBeenCalled();
  });

  it("requires completion before an eligible professor issues a completion certificate", async () => {
    db.researchProject.findUnique.mockResolvedValue({
      collegeId,
      status: "APPROVED",
      members: [],
      workflowInstance: { workflow: { createdBy: "user-a" } },
    });
    const res = response();
    await handler(
      admin,
      "post",
      "/certificates",
    )(
      { user: user(["RESEARCH_COORDINATOR"]), body: { researchId: "project" } },
      res,
    );
    expect(res.statusCode).toBe(409);
    expect(db.certificate.create).not.toHaveBeenCalled();
  });

  it("restricts administrator metrics before querying institutional data", () => {
    const next = vi.fn();
    const res = response();
    handler(admin, "get", "/admin/metrics", 1)({ user: user() }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("protects the last active administrator from status changes", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "admin",
      status: "ACTIVE",
      roles: [{ role: { name: "SYSTEM_ADMIN" } }],
    });
    db.user.count.mockResolvedValue(1);
    await expect(
      changeAccountStatus({
        actor: user(["SYSTEM_ADMIN"]),
        userId: "admin",
        status: "SUSPENDED",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("requires exact verification confirmation and a note for activation", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "pending",
      status: "PENDING",
      roles: [],
    });
    await expect(
      changeAccountStatus({
        actor: user(["SYSTEM_ADMIN"]),
        userId: "pending",
        status: "ACTIVE",
        verificationConfirmed: "true",
        verificationNote: "Institutional verification completed",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("audits verified account activation", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "pending",
      status: "PENDING",
      roles: [],
    });
    db.user.update.mockResolvedValue({ id: "pending", status: "ACTIVE" });
    await changeAccountStatus({
      actor: user(["SYSTEM_ADMIN"]),
      userId: "pending",
      status: "ACTIVE",
      verificationConfirmed: true,
      verificationNote: "Verified institutional record",
    });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe("APPROVE");
  });

  it("serializes nested project file sizes safely", async () => {
    db.researchProject.findFirst.mockResolvedValue({
      id: "project",
      documents: [{ versions: [{ fileSize: 1024n }] }],
    });
    const res = response();
    await handler(
      research,
      "get",
      "/:id",
    )({ user: user(), params: { id: "project" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.project.documents[0].versions[0].fileSize).toBe(1024);
    const scope = db.researchProject.findFirst.mock.calls[0][0].where;
    expect(JSON.stringify(scope)).not.toContain("workspace");
  });

  it.each(["RESEARCH_COORDINATOR", "SYSTEM_ADMIN"])(
    "does not expose private calendar entries to %s through a scope shortcut",
    async (roleName) => {
      db.calendarEvent.findMany.mockResolvedValue([]);
      db.consultation.findMany.mockResolvedValue([]);
      db.defenseSession.findMany.mockResolvedValue([]);
      const res = response();
      await handler(
        calendar,
        "get",
        "/calendar",
      )({ user: user([roleName]), query: {} }, res);
      expect(res.statusCode).toBe(200);
      const conditions = db.calendarEvent.findMany.mock.calls[0][0].where.OR;
      expect(conditions).not.toContainEqual({ collegeId });
      expect(conditions).toContainEqual({ visibility: "COLLEGE", collegeId });
    },
  );

  it("does not let an administrator edit another person's personal entry by ID", async () => {
    db.calendarEvent.findUnique.mockResolvedValue({
      id: "private",
      collegeId,
      createdBy: "other",
      visibility: "PARTICIPANTS",
      cancelledAt: null,
    });
    const res = response();
    await handler(
      calendar,
      "patch",
      "/calendar/:id",
    )(
      { user: user(["SYSTEM_ADMIN"]), params: { id: "private" }, body: {} },
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(db.calendarEvent.update).not.toHaveBeenCalled();
  });

  it("grants professor workflow creation without granting user administration", () => {
    const permissions = getPermissionsForRoles(["RESEARCH_COORDINATOR"]);
    expect(permissions).toContain("workflow.create");
    expect(permissions).not.toContain("user.manage");
  });
});

describe("workflow and released grade contracts", () => {
  const workflow = (id: string, researchTypeId = "type-a") => ({
    id,
    researchTypeId,
    status: "DRAFT",
    stages: [{ id: "stage" }],
  });
  it("requires an explicit selection when multiple joined workflows are eligible", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([
      { workflow: workflow("one") },
      { workflow: workflow("two") },
    ]);
    db.researchType.findMany.mockResolvedValue([{ id: "type-a", programId }]);
    await expect(
      resolveRegistrationWorkflow(user(), programId),
    ).rejects.toThrow("Select the workflow");
  });
  it("rejects a joined workflow whose research type is outside the program", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([
      { workflow: workflow("one", "foreign-type") },
    ]);
    db.researchType.findMany.mockResolvedValue([{ id: "type-a", programId }]);
    await expect(
      resolveRegistrationWorkflow(user(), programId, "one"),
    ).rejects.toThrow("Join an active workflow");
  });
  it("uses the selected joined workflow instead of the research type default", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([
      { workflow: workflow("selected") },
    ]);
    db.researchType.findMany.mockResolvedValue([
      { id: "type-a", programId, workflowId: "different-default" },
    ]);
    expect(
      (await resolveRegistrationWorkflow(user(), programId, "selected"))
        .workflow?.id,
    ).toBe("selected");
  });
  it("never exposes unreleased evaluation scores", async () => {
    db.researchMember.findFirst.mockResolvedValue({ id: "member" });
    db.defenseSession.findFirst.mockResolvedValue(null);
    const grades = await getReleasedGradeReport(user(), "project");
    expect(grades).toMatchObject({
      status: "pending",
      finalGrade: null,
      panelistScores: [],
    });
    expect(
      db.defenseSession.findFirst.mock.calls[0][0].where.releasedAt,
    ).toEqual({ not: null });
    expect(
      db.defenseSession.findFirst.mock.calls[0][0].include.evaluations.where
        .status,
    ).toBe("LOCKED");
  });
  it("returns scores from a released session and normalizes differing rubric totals", async () => {
    db.researchMember.findFirst.mockResolvedValue({ id: "member" });
    db.defenseSession.findFirst.mockResolvedValue({
      evaluations: [
        {
          id: "one",
          totalScore: 40,
          template: { totalScore: 50 },
          evaluator: { firstName: "A", lastName: "B" },
        },
        {
          id: "two",
          totalScore: 90,
          template: { totalScore: 100 },
          evaluator: { firstName: "C", lastName: "D" },
        },
      ],
    });
    expect(await getReleasedGradeReport(user(), "project")).toMatchObject({
      status: "released",
      finalGrade: "85.00%",
    });
  });
  it("denies grade access to a nonmember", async () => {
    db.researchMember.findFirst.mockResolvedValue(null);
    await expect(
      getReleasedGradeReport(user(), "project"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("recovery and reliability", () => {
  it("rejects expired reset tokens without changing a password", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "user",
      status: "ACTIVE",
      passwordResetExpiresAt: new Date(0),
    });
    await expect(
      resetPassword("a".repeat(64), "NewPassword123!"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it("consumes a hashed token conditionally and invalidates earlier sessions", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "user",
      status: "ACTIVE",
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    await resetPassword("a".repeat(64), "NewPassword123!");
    const update = db.user.updateMany.mock.calls[0][0];
    expect(update.where.passwordResetTokenHash).toBe(
      recoveryTokenHash("a".repeat(64)),
    );
    expect(update.data.sessionVersion).toEqual({ increment: 1 });
    expect(update.data.passwordResetTokenHash).toBeNull();
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      resetPassword("a".repeat(64), "AnotherPassword123!"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("does not claim recovery delivery when the email provider is unconfigured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(
      requestPasswordRecovery("test@example.org"),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it("rejects an earlier token after session version changes", async () => {
    const token = generateToken("user-a", 0);
    db.user.findUnique.mockResolvedValue({
      id: "user-a",
      status: "ACTIVE",
      sessionVersion: 1,
      roles: [],
    });
    const res = response();
    const next = vi.fn();
    await requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as any,
      res as any,
      next,
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("does not turn an authentication database outage into an invalid-session response", async () => {
    db.user.findUnique.mockRejectedValue(new Error("Database unavailable"));
    const res = response();
    await requireAuth(
      {
        headers: { authorization: `Bearer ${generateToken("user-a")}` },
      } as any,
      res as any,
      vi.fn(),
    );
    expect(res.statusCode).toBe(503);
  });
  it("forwards rejected async handlers to Express error handling", async () => {
    const next = vi.fn();
    asyncHandler(async () => {
      throw new Error("Database unavailable");
    })({} as any, {} as any, next);
    await vi.waitFor(() =>
      expect(next).toHaveBeenCalledWith(expect.any(Error)),
    );
  });
  it("does not manufacture a Google Meet URL without a configured provider", async () => {
    const original = (googleCalendarService as any).calendar;
    (googleCalendarService as any).calendar = null;
    try {
      await expect(
        googleCalendarService.createMeetConsultation({
          title: "Meeting",
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 60_000),
        }),
      ).rejects.toThrow("not configured");
    } finally {
      (googleCalendarService as any).calendar = original;
    }
  });
  it("formats Manila date and time consistently around midnight", () => {
    const view = serializeConsultation({
      scheduledStart: "2026-10-18T17:00:00Z",
      scheduledEnd: "2026-10-18T18:00:00Z",
      status: "SCHEDULED",
    });
    expect(view.date).toBe("2026-10-19");
    expect(view.time).toMatch(/01:00|1:00/);
  });
});
