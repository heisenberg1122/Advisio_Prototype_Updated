import crypto from "node:crypto";
import http from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FacultyProfileUpdateInput } from "@research-management/validations";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.AUTH_SECRET ||
  "advisio-super-secret-key-change-in-production";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

interface FixtureUser {
  id: string;
  collegeId: string;
}

interface FacultyProfileFixture {
  adviser: FixtureUser;
  student: FixtureUser;
  otherCollegeStudent: FixtureUser;
  userIds: string[];
  programIds: string[];
  collegeIds: string[];
}

interface OwnProfileResponse {
  profile: { academicTitle?: string | null } | null;
  user: { id: string };
  capacity: { availableSlots: number };
  completion: { percentage: number };
}

interface UpdateProfileResponse {
  message: string;
  profile: {
    academicTitle: string | null;
    educations: FacultyProfileUpdateInput["educations"];
  };
  completion: { percentage: number };
}

interface PublicProfileResponse {
  adviser: {
    name: string;
    isVerified: boolean;
    capacity: { availableSlots: number };
    profile: {
      academicTitle: string | null;
      educations: FacultyProfileUpdateInput["educations"];
      certifications: Array<{
        title: string;
        licenseNumber?: string | null;
      }>;
    } | null;
  };
}

async function closeServer(server: http.Server | undefined): Promise<void> {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

databaseDescribe("Faculty Profile End-to-End API Persistence Suite", () => {
  const fixtureSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const fixtureScope = createIntegrationFixtureScope(
    `faculty-profile-${fixtureSuffix.toLowerCase()}`,
  );
  let server: http.Server | undefined;
  let baseUrl = "";
  let fixture: FacultyProfileFixture | undefined;
  let adviserToken = "";
  let studentToken = "";
  let otherCollegeToken = "";

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixtureScope.databaseVerified = true;

    fixture = await prisma.$transaction(async (tx) => {
      const adviserRole = await tx.role.upsert({
        where: { name: "ADVISER" },
        update: {},
        create: { name: "ADVISER", description: "Integration test adviser" },
      });
      const researcherRole = await tx.role.upsert({
        where: { name: "RESEARCHER" },
        update: {},
        create: {
          name: "RESEARCHER",
          description: "Integration test researcher",
        },
      });

      const adviserCollege = await tx.college.create({
        data: {
          code: `FPA${fixtureSuffix}`,
          name: `Faculty Profile Adviser College ${fixtureSuffix}`,
        },
      });
      const otherCollege = await tx.college.create({
        data: {
          code: `FPO${fixtureSuffix}`,
          name: `Faculty Profile Other College ${fixtureSuffix}`,
        },
      });
      const adviserProgram = await tx.program.create({
        data: {
          collegeId: adviserCollege.id,
          code: `FPA${fixtureSuffix}`,
          name: `Faculty Profile Adviser Program ${fixtureSuffix}`,
        },
      });
      const otherProgram = await tx.program.create({
        data: {
          collegeId: otherCollege.id,
          code: `FPO${fixtureSuffix}`,
          name: `Faculty Profile Other Program ${fixtureSuffix}`,
        },
      });

      const adviser = await tx.user.create({
        data: {
          universityId: `FPA-${fixtureSuffix}`,
          email: `faculty-profile-${fixtureSuffix.toLowerCase()}-adviser@integration.test`,
          firstName: "Faculty",
          lastName: "Fixture",
          status: "ACTIVE",
          collegeId: adviserCollege.id,
          programId: adviserProgram.id,
        },
      });
      const student = await tx.user.create({
        data: {
          universityId: `FPS-${fixtureSuffix}`,
          email: `faculty-profile-${fixtureSuffix.toLowerCase()}-student@integration.test`,
          firstName: "Student",
          lastName: "Fixture",
          status: "ACTIVE",
          collegeId: adviserCollege.id,
          programId: adviserProgram.id,
        },
      });
      const otherCollegeStudent = await tx.user.create({
        data: {
          universityId: `FPO-${fixtureSuffix}`,
          email: `faculty-profile-${fixtureSuffix.toLowerCase()}-outsider@integration.test`,
          firstName: "Outsider",
          lastName: "Fixture",
          status: "ACTIVE",
          collegeId: otherCollege.id,
          programId: otherProgram.id,
        },
      });

      await tx.userRole.createMany({
        data: [
          { userId: adviser.id, roleId: adviserRole.id },
          { userId: student.id, roleId: researcherRole.id },
          { userId: otherCollegeStudent.id, roleId: researcherRole.id },
        ],
      });

      return {
        adviser: { id: adviser.id, collegeId: adviserCollege.id },
        student: { id: student.id, collegeId: adviserCollege.id },
        otherCollegeStudent: {
          id: otherCollegeStudent.id,
          collegeId: otherCollege.id,
        },
        userIds: [adviser.id, student.id, otherCollegeStudent.id],
        programIds: [adviserProgram.id, otherProgram.id],
        collegeIds: [adviserCollege.id, otherCollege.id],
      };
    });
    fixtureScope.collegeIds.push(...fixture.collegeIds);
    fixtureScope.programIds.push(...fixture.programIds);
    fixtureScope.userIds.push(...fixture.userIds);

    adviserToken = jwt.sign({ userId: fixture.adviser.id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    studentToken = jwt.sign({ userId: fixture.student.id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    otherCollegeToken = jwt.sign(
      { userId: fixture.otherCollegeStudent.id },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    await new Promise<void>((resolve, reject) => {
      const candidate = http.createServer(app);
      server = candidate;
      candidate.once("error", reject);
      candidate.listen(0, () => {
        const address = candidate.address();
        if (!address || typeof address === "string") {
          reject(
            new Error("Integration test server did not expose a TCP port."),
          );
          return;
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    const teardownErrors: unknown[] = [];

    try {
      await closeServer(server);
    } catch (error) {
      teardownErrors.push(error);
    }

    try {
      await cleanupIntegrationFixture(prisma, fixtureScope);
    } catch (error) {
      teardownErrors.push(error);
    }

    try {
      await prisma.$disconnect();
    } catch (error) {
      teardownErrors.push(error);
    }

    if (teardownErrors.length > 0) {
      throw new AggregateError(
        teardownErrors,
        "Faculty profile integration teardown failed.",
      );
    }
  });

  it("GET /api/faculty-profiles/me returns profile and completion stats gracefully", async () => {
    const response = await fetch(`${baseUrl}/api/faculty-profiles/me`, {
      headers: { Authorization: `Bearer ${adviserToken}` },
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as OwnProfileResponse;
    expect(data.user.id).toBe(fixture?.adviser.id);
    expect(data.profile).toBeNull();
    expect(data.capacity).toBeDefined();
    expect(typeof data.completion.percentage).toBe("number");
  });

  it("PUT /api/faculty-profiles/me updates and persists professional credentials to database", async () => {
    const payload = {
      academicTitle: "Ph.D., PE",
      facultyDesignation: "Associate Professor",
      department: "Information Technology",
      biography:
        "Distinguished researcher with 12 years of capstone mentoring experience.",
      teachingBackground:
        "Software engineering, distributed computing, and web architectures.",
      mentoringPhilosophy:
        "Fostering critical thinking through real-world software delivery.",
      preferredProjectTypes:
        "Enterprise systems, AI applied models, and cloud architectures.",
      expertiseKeywords: [
        "Web Development",
        "Software Engineering",
        "Artificial Intelligence",
      ],
      researchInterests: ["Machine Learning", "Educational Technology"],
      specializedTopics: [
        "Deep learning in agriculture",
        "Microservices security",
      ],
      supervisionMethodologies: ["Agile/Scrum", "Design Science"],
      acceptedResearchTypes: ["Applied Research", "Experimental Research"],
      advisingPreferences:
        "Weekly sprint reviews and bi-weekly formal demos required.",
      educations: [
        {
          id: "edu-test-1",
          degreeLevel: "DOCTORATE",
          degreeName: "Ph.D. in Computer Science",
          fieldOfStudy: "Computer Science",
          institution: "University of the Assumption",
          graduationYear: 2019,
        },
      ],
      certifications: [
        {
          id: "cert-test-1",
          title: "AWS Certified Solutions Architect - Professional",
          issuingBody: "Amazon Web Services",
          yearIssued: 2022,
          licenseNumber: "CONFIDENTIAL-LICENSE-999",
        },
      ],
      experiences: [
        {
          id: "exp-test-1",
          type: "TEACHING",
          title: "Associate Professor",
          organization: "College of Computing",
          startYear: 2017,
          endYear: null,
          isCurrent: true,
          description: "Leading capstone and senior research courses.",
        },
      ],
      publications: [
        {
          id: "pub-test-1",
          title: "AI in University Research Management",
          venue: "Philippine Computing Journal",
          year: 2024,
          authors: "Santos, M. & Reyes, J.",
          url: "https://example.edu/paper",
        },
      ],
      awards: [
        {
          id: "award-test-1",
          title: "Outstanding Research Mentor of the Year",
          issuingOrganization: "University of the Assumption",
          year: 2023,
          description:
            "Awarded for excellence in undergraduate capstone supervision.",
        },
      ],
    } satisfies FacultyProfileUpdateInput;

    const response = await fetch(`${baseUrl}/api/faculty-profiles/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adviserToken}`,
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as UpdateProfileResponse;
    expect(body.message).toBe("Professional profile updated successfully");
    expect(body.profile.academicTitle).toBe("Ph.D., PE");
    expect(body.profile.educations).toHaveLength(1);
    expect(body.completion.percentage).toBeGreaterThanOrEqual(85);

    const persisted = await prisma.facultyProfile.findUnique({
      where: { userId: fixture!.adviser.id },
    });
    expect(persisted?.academicTitle).toBe("Ph.D., PE");
    expect(persisted?.supervisionMethodologies).toEqual([
      "Agile/Scrum",
      "Design Science",
    ]);
  });

  it("GET /api/faculty-profiles/:userId allows students to view verified adviser CV while stripping sensitive fields", async () => {
    const response = await fetch(
      `${baseUrl}/api/faculty-profiles/${fixture!.adviser.id}`,
      { headers: { Authorization: `Bearer ${studentToken}` } },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as PublicProfileResponse;
    expect(body.adviser.name).toBeDefined();
    expect(body.adviser.isVerified).toBe(true);
    expect(body.adviser.capacity).toBeDefined();
    expect(body.adviser.profile).not.toBeNull();
    expect(body.adviser.profile?.academicTitle).toBe("Ph.D., PE");
    expect(body.adviser.profile?.educations).toHaveLength(1);
    expect(body.adviser.profile?.educations[0]?.degreeName).toBe(
      "Ph.D. in Computer Science",
    );
    expect(body.adviser.profile?.certifications).toHaveLength(1);
    expect(body.adviser.profile?.certifications[0]?.title).toBe(
      "AWS Certified Solutions Architect - Professional",
    );
    expect(
      body.adviser.profile?.certifications[0]?.licenseNumber,
    ).toBeUndefined();
  });

  it("denies students from modifying faculty profiles", async () => {
    const response = await fetch(`${baseUrl}/api/faculty-profiles/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ biography: "Malicious attempt by student" }),
    });

    expect(response.status).toBe(403);
  });

  it("enforces college scoping for adviser profile visibility", async () => {
    const response = await fetch(
      `${baseUrl}/api/faculty-profiles/${fixture!.adviser.id}`,
      { headers: { Authorization: `Bearer ${otherCollegeToken}` } },
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("different college");
  });
});
