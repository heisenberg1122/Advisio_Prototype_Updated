import crypto from "node:crypto";
import http from "node:http";
import bcrypt from "bcryptjs";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const delivery = vi.hoisted(() => vi.fn());
vi.mock("@research-management/email", async (original) => ({
  ...(await original<typeof import("@research-management/email")>()),
  sendEmail: delivery,
}));
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("account invitation persistence and access", () => {
  const marker = `account-invite-${crypto.randomUUID().slice(0, 8)}`;
  const scope = createIntegrationFixtureScope(marker);
  let server: http.Server | undefined,
    base: string,
    administratorId: string,
    administratorToken: string,
    collegeId: string;
  let sequence = 0;
  let clientNumber = 0;
  const post = (
    path: string,
    body: unknown,
    authenticated: boolean | string = false,
  ) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `192.0.2.${clientNumber}`,
        ...(authenticated
          ? {
              Authorization: `Bearer ${typeof authenticated === "string" ? authenticated : administratorToken}`,
            }
          : {}),
      },
      body: JSON.stringify(body),
    });
  const payload = () => {
    const number = ++sequence;
    return {
      email: `${marker}-${number}@example.invalid`,
      universityId: `${marker}-${number}`,
      firstName: "Invited",
      lastName: "Faculty",
      collegeId,
      roleNames: ["RESEARCH_COORDINATOR", "PANELIST"],
      verificationConfirmed: true,
      verificationNote:
        "Institutional appointment verified for integration test",
    };
  };
  const tokenFromEmail = () =>
    new URL(
      delivery.mock.calls.at(-1)![0].text.match(/https:\/\/\S+/)![0],
    ).hash.slice(7);
  const invite = async (roleNames?: string[]) => {
    const input = { ...payload(), ...(roleNames ? { roleNames } : {}) };
    const response = await post("/", input, true);
    const result = (await response.json()) as any;
    expect(response.status, JSON.stringify(result)).toBe(201);
    return {
      input,
      token: tokenFromEmail(),
      id: result.invitationId as string,
    };
  };
  const createCollege = async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const college = await prisma.college.create({
      data: { code: `INV-${suffix}`, name: `${marker}-${suffix}` },
    });
    scope.collegeIds.push(college.id);
    return college.id;
  };
  const faculty = async (
    homeCollege: string,
    roleNames: ("DEAN" | "ADVISER" | "PANELIST" | "RESEARCH_COORDINATOR")[],
  ) => {
    const input = payload();
    const roles = await prisma.role.findMany({
      where: { name: { in: roleNames } },
    });
    const user = await prisma.user.create({
      data: {
        email: input.email,
        universityId: input.universityId,
        firstName: "Existing",
        lastName: "Faculty",
        collegeId: homeCollege,
        status: "ACTIVE",
        passwordHash: "preserve-this-password-hash",
        roles: { create: roles.map((role) => ({ roleId: role.id })) },
        collegeMemberships: { create: { collegeId: homeCollege, roleNames } },
      },
    });
    scope.userIds.push(user.id);
    return { ...user, token: generateToken(user.id) };
  };
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    scope.databaseVerified = true;
    for (const name of [
      "SYSTEM_ADMIN",
      "RESEARCHER",
      "ADVISER",
      "RESEARCH_COORDINATOR",
      "PANELIST",
      "DEAN",
    ] as const)
      await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    const college = await prisma.college.create({
      data: { code: `INV-${marker.slice(-8)}`, name: marker },
    });
    collegeId = college.id;
    scope.collegeIds.push(college.id);
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: "SYSTEM_ADMIN" },
    });
    const admin = await prisma.user.create({
      data: {
        email: `${marker}-admin@example.invalid`,
        universityId: `${marker}-admin`,
        firstName: "Invitation",
        lastName: "Administrator",
        collegeId,
        status: "ACTIVE",
        roles: { create: { roleId: role.id } },
      },
    });
    administratorId = admin.id;
    administratorToken = generateToken(admin.id);
    scope.userIds.push(admin.id);
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "integration-placeholder");
    vi.stubEnv("EMAIL_FROM", "Advisio <invite@example.invalid>");
    vi.stubEnv("WEB_URL", "https://advisio.example.test");
    // Match Render's one-hop trusted proxy; each test models a distinct client.
    app.set("trust proxy", 1);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}/api/account-invitations`;
  });
  beforeEach(() => {
    clientNumber++;
    delivery.mockReset();
    delivery.mockResolvedValue({ success: true });
  });
  afterAll(async () => {
    server?.closeAllConnections();
    if (server?.listening)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (scope.databaseVerified) {
      await prisma.accountInvitation.deleteMany({
        where: { collegeId: { in: scope.collegeIds } },
      });
      scope.userIds.push(
        ...(
          await prisma.user.findMany({
            where: { collegeId },
            select: { id: true },
          })
        ).map(({ id }) => id),
      );
      await cleanupIntegrationFixture(prisma, scope);
    }
    vi.unstubAllEnvs();
    await prisma.$disconnect();
  });

  it("creates no user until acceptance, stores only the hash, and lists no token", async () => {
    const { input, token, id } = await invite();
    expect(
      await prisma.user.findUnique({ where: { email: input.email } }),
    ).toBeNull();
    const stored = await prisma.accountInvitation.findUniqueOrThrow({
      where: { id },
    });
    expect(stored.tokenHash).toBe(
      crypto.createHash("sha256").update(token).digest("hex"),
    );
    expect(stored.tokenHash).not.toBe(token);
    const list = await fetch(base, {
      headers: { Authorization: `Bearer ${administratorToken}` },
    });
    const body = await list.text();
    expect(body).not.toContain(token);
    expect(body).not.toContain(stored.tokenHash);
    expect(body).toContain(input.verificationNote);
    expect(delivery.mock.calls[0][0].text).toContain("#token=");
  });
  it.each(["ADVISER", "DEAN", "PANELIST", "RESEARCH_COORDINATOR"])(
    "creates only the approved %s role",
    async (role) => {
      const invitation = await invite([role]);
      expect(
        (
          await post("/accept", {
            token: invitation.token,
            password: "A unique role password 42",
          })
        ).status,
      ).toBe(200);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: invitation.input.email },
        include: { roles: { include: { role: true } } },
      });
      expect(user.roles.map(({ role }) => role.name)).toEqual([role]);
    },
  );
  it("activates approved roles and college once, using the invitee's hashed password", async () => {
    const { input, token } = await invite();
    const preview = (await (await post("/preview", { token })).json()) as any;
    expect(preview.invitation.roleNames).toEqual(input.roleNames);
    const response = await post("/accept", {
      token,
      password: "Unique invitation password 42",
    });
    expect(response.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: input.email },
      include: { roles: { include: { role: true } }, facultyProfile: true },
    });
    expect(user.status).toBe("ACTIVE");
    expect(user.collegeId).toBe(collegeId);
    expect(user.facultyProfile).not.toBeNull();
    expect(user.roles.map(({ role }) => role.name).sort()).toEqual(
      [...input.roleNames].sort(),
    );
    expect(
      await bcrypt.compare("Unique invitation password 42", user.passwordHash!),
    ).toBe(true);
    const origin = new URL(base).origin;
    const signIn = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: "Unique invitation password 42",
      }),
    });
    expect(signIn.status).toBe(200);
    const session = (await signIn.json()) as any;
    expect(session.user.roles.sort()).toEqual([...input.roleNames].sort());
    const profile = await fetch(`${origin}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(profile.status).toBe(200);
    expect(((await profile.json()) as any).user.college.id).toBe(collegeId);
    expect(
      (await post("/accept", { token, password: "Another unique password 42" }))
        .status,
    ).toBe(400);
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(1);
  });
  it("rejects expired and revoked links without creating accounts", async () => {
    const expired = await invite();
    await prisma.accountInvitation.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (
        await post("/accept", {
          token: expired.token,
          password: "Unique invitation password 42",
        })
      ).status,
    ).toBe(400);
    const revoked = await invite();
    expect((await post(`/${revoked.id}/revoke`, {}, true)).status).toBe(200);
    expect((await post("/preview", { token: revoked.token })).status).toBe(400);
  });
  it("resends with a new token and immediately invalidates the previous one", async () => {
    const original = await invite();
    await prisma.accountInvitation.update({
      where: { id: original.id },
      data: { lastSentAt: new Date(Date.now() - 120_000) },
    });
    expect((await post(`/${original.id}/resend`, {}, true)).status).toBe(200);
    const newToken = tokenFromEmail();
    expect(newToken).not.toBe(original.token);
    expect((await post("/preview", { token: original.token })).status).toBe(
      400,
    );
    expect((await post("/preview", { token: newToken })).status).toBe(200);
    expect(
      await prisma.accountInvitation.count({
        where: { email: original.input.email, status: "PENDING" },
      }),
    ).toBe(1);
  });
  it("keeps failed delivery unusable and reports a failure to the administrator", async () => {
    delivery.mockResolvedValue({ success: false });
    const input = payload();
    expect((await post("/", input, true)).status).toBe(503);
    const invitation = await prisma.accountInvitation.findFirstOrThrow({
      where: { email: input.email },
    });
    expect(invitation.status).toBe("DELIVERY_FAILED");
    expect(invitation.deliveredAt).toBeNull();
    expect((await post("/preview", { token: tokenFromEmail() })).status).toBe(
      400,
    );
  });
  it("refuses mock delivery and inactive colleges without creating invitations", async () => {
    const input = payload();
    vi.stubEnv("EMAIL_PROVIDER", "mock");
    try {
      expect((await post("/", input, true)).status).toBe(503);
    } finally {
      vi.stubEnv("EMAIL_PROVIDER", "resend");
    }
    expect(
      await prisma.accountInvitation.count({ where: { email: input.email } }),
    ).toBe(0);
    await prisma.college.update({
      where: { id: collegeId },
      data: { isActive: false },
    });
    try {
      expect((await post("/", input, true)).status).toBe(400);
    } finally {
      await prisma.college.update({
        where: { id: collegeId },
        data: { isActive: true },
      });
    }
    expect(delivery).not.toHaveBeenCalled();
  });
  it("never overwrites a registered user's password, college, status, or roles", async () => {
    const original = await invite();
    const existing = await prisma.user.create({
      data: {
        email: original.input.email.toUpperCase(),
        universityId: original.input.universityId,
        firstName: "Existing",
        lastName: "Person",
        status: "SUSPENDED",
        passwordHash: "unchanged-password",
        collegeId: null,
      },
    });
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: existing.id },
      include: { roles: true },
    });
    scope.userIds.push(existing.id);
    expect((await post("/", original.input, true)).status).toBe(409);
    expect(
      (
        await post("/accept", {
          token: original.token,
          password: "A brand new password 42",
        })
      ).status,
    ).toBe(409);
    expect(
      await prisma.user.findUnique({
        where: { id: existing.id },
        include: { roles: true },
      }),
    ).toEqual(before);
  });
  it("does not authorize links after their issuer loses administrator access", async () => {
    const invitation = await invite();
    await prisma.user.update({
      where: { id: administratorId },
      data: { status: "SUSPENDED" },
    });
    try {
      expect((await post("/preview", { token: invitation.token })).status).toBe(
        403,
      );
    } finally {
      await prisma.user.update({
        where: { id: administratorId },
        data: { status: "ACTIVE" },
      });
    }
  });
  it("accepts concurrent submissions at most once", async () => {
    const invitation = await invite();
    const responses = await Promise.all(
      [1, 2].map(() =>
        post("/accept", {
          token: invitation.token,
          password: "Concurrent secure password 42",
        }),
      ),
    );
    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(1);
    expect(
      await prisma.user.count({ where: { email: invitation.input.email } }),
    ).toBe(1);
  });
  it("lets a Dean invite an adviser only in their own college and only after recipient acceptance", async () => {
    const dean = await faculty(collegeId, ["DEAN"]);
    const input = { ...payload(), roleNames: ["ADVISER"] };
    expect(
      (
        await post(
          "/",
          { ...input, collegeId: await createCollege() },
          dean.token,
        )
      ).status,
    ).toBe(403);
    expect(
      (await post("/", { ...input, roleNames: ["DEAN"] }, dean.token)).status,
    ).toBe(403);
    const response = await post("/", input, dean.token);
    expect(response.status).toBe(201);
    const link = tokenFromEmail();
    expect(
      await prisma.user.findUnique({ where: { email: input.email } }),
    ).toBeNull();
    expect(
      (
        await post("/accept", {
          token: link,
          password: "New adviser password 42",
        })
      ).status,
    ).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: input.email },
      include: { collegeMemberships: true },
    });
    expect(user.collegeMemberships).toEqual([
      expect.objectContaining({ collegeId, roleNames: ["ADVISER"] }),
    ]);
  });
  it("requires administrator review for professor and panelist requests and supports rejection", async () => {
    const dean = await faculty(collegeId, ["DEAN"]);
    const input = {
      ...payload(),
      roleNames: ["RESEARCH_COORDINATOR", "PANELIST"],
    };
    const result = (await (await post("/", input, dean.token)).json()) as any;
    expect(delivery).not.toHaveBeenCalled();
    expect(
      (
        await prisma.accountInvitation.findUniqueOrThrow({
          where: { id: result.invitationId },
        })
      ).status,
    ).toBe("AWAITING_APPROVAL");
    const review = {
      verificationConfirmed: true,
      verificationNote: "Institutional appointments reviewed",
    };
    expect(
      (await post(`/${result.invitationId}/approve`, review, dean.token))
        .status,
    ).toBe(403);
    expect(
      (
        await post(
          `/${result.invitationId}/approve`,
          { ...review, verificationConfirmed: false },
          true,
        )
      ).status,
    ).toBe(400);
    expect(
      (await post(`/${result.invitationId}/reject`, review, true)).status,
    ).toBe(200);
    expect(delivery).not.toHaveBeenCalled();
    expect(
      await prisma.user.findUnique({ where: { email: input.email } }),
    ).toBeNull();
    expect(
      (await post(`/${result.invitationId}/approve`, review, true)).status,
    ).toBe(409);
  });
  it("connects invitations from two colleges to one account without leaking roles or replacing credentials", async () => {
    const secondCollege = await createCollege();
    const thirdCollege = await createCollege();
    const deanB = await faculty(secondCollege, ["DEAN"]),
      deanC = await faculty(thirdCollege, ["DEAN"]);
    const person = await faculty(collegeId, ["ADVISER"]);
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: person.id },
    });
    for (const [dean, targetCollege, roleNames] of [
      [deanB, secondCollege, ["RESEARCH_COORDINATOR"]],
      [deanC, thirdCollege, ["PANELIST"]],
    ] as const) {
      const response = await post(
        "/",
        {
          ...payload(),
          email: person.email,
          universityId: person.universityId,
          collegeId: targetCollege,
          roleNames,
        },
        dean.token,
      );
      const result = (await response.json()) as any;
      expect(response.status, JSON.stringify(result)).toBe(201);
      expect(
        (
          await prisma.accountInvitation.findUniqueOrThrow({
            where: { id: result.invitationId },
          })
        ).status,
      ).toBe("AWAITING_APPROVAL");
      expect(
        (
          await post(
            `/${result.invitationId}/approve`,
            {
              verificationConfirmed: true,
              verificationNote: "Cross-college faculty appointment verified",
            },
            true,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await post(
            "/accept-existing",
            { token: tokenFromEmail() },
            person.token,
          )
        ).status,
      ).toBe(200);
    }
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: person.id },
      include: { collegeMemberships: true },
    });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.collegeId).toBe(before.collegeId);
    expect(after.firstName).toBe(before.firstName);
    expect(await prisma.user.count({ where: { email: person.email } })).toBe(1);
    const origin = new URL(base).origin;
    const switchResponse = await fetch(`${origin}/api/auth/active-college`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${person.token}`,
      },
      body: JSON.stringify({ collegeId: secondCollege }),
    });
    expect(switchResponse.status).toBe(200);
    const session = (await switchResponse.json()) as any;
    const me = (await (
      await fetch(`${origin}/api/auth/me`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
    ).json()) as any;
    expect(me.user.roles).toEqual(["RESEARCH_COORDINATOR"]);
    expect(me.user.college.id).toBe(secondCollege);
    expect(me.user.collegeMemberships).toHaveLength(3);
    const program = await prisma.program.create({
      data: { collegeId, code: marker.slice(-12), name: marker },
    });
    scope.programIds.push(program.id);
    const year = await prisma.academicYear.create({
      data: {
        name: marker.slice(-20),
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      },
    });
    scope.academicYearIds.push(year.id);
    const type = await prisma.researchType.create({
      data: { programId: program.id, code: marker, name: marker },
    });
    scope.researchTypeIds.push(type.id);
    const project = await prisma.researchProject.create({
      data: {
        collegeId,
        programId: program.id,
        academicYearId: year.id,
        researchTypeId: type.id,
        title: marker,
        createdBy: person.id,
        members: { create: { userId: person.id, projectRole: "ADVISER" } },
      },
    });
    scope.projectIds.push(project.id);
    const otherCollegeProject = await fetch(
      `${origin}/api/research/${project.id}`,
      { headers: { Authorization: `Bearer ${session.token}` } },
    );
    expect(otherCollegeProject.status).toBe(403);
    const forbidden = await fetch(`${origin}/api/auth/active-college`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${person.token}`,
      },
      body: JSON.stringify({ collegeId: crypto.randomUUID() }),
    });
    expect(forbidden.status).toBe(403);
  });
  it("requires the matching signed-in existing account and does not expose password replacement", async () => {
    const person = await faculty(collegeId, ["ADVISER"]),
      other = await faculty(collegeId, ["PANELIST"]);
    const response = await post(
      "/",
      {
        ...payload(),
        email: person.email,
        universityId: person.universityId,
        roleNames: ["PANELIST"],
      },
      true,
    );
    expect(response.status).toBe(201);
    const token = tokenFromEmail();
    expect(
      (
        await post("/accept", {
          token,
          password: "Replacement password attempt 42",
        })
      ).status,
    ).toBe(409);
    expect(
      (await post("/accept-existing", { token }, other.token)).status,
    ).toBe(409);
    expect((await post("/accept-existing", { token })).status).toBe(401);
    expect(
      (await post("/accept-existing", { token }, person.token)).status,
    ).toBe(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: person.id } }))
        .passwordHash,
    ).toBe("preserve-this-password-hash");
  });
  it("rejects public faculty registration through both password and Google identity endpoints", async () => {
    const origin = new URL(base).origin;
    const input = payload();
    const register = await fetch(`${origin}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        role: "ADVISER",
        password: "Public faculty attempt 42",
      }),
    });
    expect(register.status).toBe(400);
    const google = await fetch(
      `${origin}/api/auth/google/onboarding-identity`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          onboardingToken: "a".repeat(64),
          accountType: "FACULTY",
          programId: crypto.randomUUID(),
          policiesAccepted: true,
        }),
      },
    );
    expect(google.status).toBe(400);
    expect(
      await prisma.user.findUnique({ where: { email: input.email } }),
    ).toBeNull();
  });
  it("rejects a token rotated after validation while acceptance waits for the account lock", async () => {
    const invitation = await invite();
    let accepting!: Promise<Response>;
    let waiting = false;
    let response!: Response;
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invitation.input.email}))`;
          accepting = post("/accept", {
            token: invitation.token,
            password: "Concurrent rotation password 42",
          });
          const deadline = Date.now() + 4_000;
          while (Date.now() < deadline) {
            await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
            const rows = await tx.$queryRaw<
              { waiting: boolean }[]
            >`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE pid <> pg_backend_pid()
            AND application_name = 'advisio-integration-tests'
            AND wait_event_type = 'Lock'
            AND query LIKE '%pg_advisory_xact_lock%'
        ) AS waiting`;
            if (rows[0]?.waiting) {
              waiting = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          // Model the exact token rotation performed by Resend before acceptance can claim it.
          await tx.accountInvitation.update({
            where: { id: invitation.id },
            data: {
              tokenHash: crypto
                .createHash("sha256")
                .update(crypto.randomBytes(32))
                .digest("hex"),
            },
          });
        },
        { timeout: 10_000 },
      );
    } finally {
      if (accepting) response = await accepting;
    }
    expect(response.status).toBe(400);
    expect(
      waiting,
      "Acceptance must validate the old token before waiting on the account lock",
    ).toBe(true);
    expect(
      await prisma.user.findUnique({
        where: { email: invitation.input.email },
      }),
    ).toBeNull();
    expect(
      (
        await prisma.accountInvitation.findUniqueOrThrow({
          where: { id: invitation.id },
        })
      ).status,
    ).toBe("PENDING");
  });
  it("rate limits repeated token lookups", async () => {
    for (let attempt = 0; attempt < 10; attempt++)
      expect((await post("/preview", { token: "f".repeat(64) })).status).toBe(
        400,
      );
    expect((await post("/preview", { token: "f".repeat(64) })).status).toBe(
      429,
    );
  });
});
