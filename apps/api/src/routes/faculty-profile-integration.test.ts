import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || "advisio-super-secret-key-change-in-production";

describe("Faculty Profile End-to-End API Persistence Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let adviserUser: any;
  let studentUser: any;
  let adviserToken: string;
  let studentToken: string;
  let otherCollegeStudent: any;
  let otherCollegeToken: string;

  beforeAll(async () => {
    // Locate sample adviser and student from database
    adviserUser = await prisma.user.findFirst({
      where: {
        email: "adviser01@university.edu.ph",
        roles: { some: { role: { name: "ADVISER" } } },
      },
    });

    studentUser = await prisma.user.findFirst({
      where: {
        collegeId: adviserUser.collegeId,
        roles: { some: { role: { name: "RESEARCHER" } } },
      },
    });

    otherCollegeStudent = await prisma.user.findFirst({
      where: {
        collegeId: { not: adviserUser.collegeId },
        roles: { some: { role: { name: "RESEARCHER" } } },
      },
    });

    expect(adviserUser).toBeDefined();
    expect(studentUser).toBeDefined();

    adviserToken = jwt.sign({ userId: adviserUser.id }, JWT_SECRET, { expiresIn: "1h" });
    studentToken = jwt.sign({ userId: studentUser.id }, JWT_SECRET, { expiresIn: "1h" });
    if (otherCollegeStudent) {
      otherCollegeToken = jwt.sign({ userId: otherCollegeStudent.id }, JWT_SECRET, { expiresIn: "1h" });
    }

    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("GET /api/faculty-profiles/me returns profile and completion stats gracefully", async () => {
    const res = await fetch(`${baseUrl}/api/faculty-profiles/me`, {
      headers: { Authorization: `Bearer ${adviserToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(adviserUser.id);
    expect(data.capacity).toBeDefined();
    expect(data.completion).toBeDefined();
    expect(typeof data.completion.percentage).toBe("number");
  });

  it("PUT /api/faculty-profiles/me updates and persists professional credentials to database", async () => {
    const payload = {
      academicTitle: "Ph.D., PE",
      facultyDesignation: "Associate Professor",
      department: "Information Technology",
      biography: "Distinguished researcher with 12 years of capstone mentoring experience.",
      teachingBackground: "Software engineering, distributed computing, and web architectures.",
      mentoringPhilosophy: "Fostering critical thinking through real-world software delivery.",
      preferredProjectTypes: "Enterprise systems, AI applied models, and cloud architectures.",
      expertiseKeywords: ["Web Development", "Software Engineering", "Artificial Intelligence"],
      researchInterests: ["Machine Learning", "Educational Technology"],
      specializedTopics: ["Deep learning in agriculture", "Microservices security"],
      supervisionMethodologies: ["Agile/Scrum", "Design Science"],
      acceptedResearchTypes: ["Applied Research", "Experimental Research"],
      advisingPreferences: "Weekly sprint reviews and bi-weekly formal demos required.",
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
          description: "Awarded for excellence in undergraduate capstone supervision.",
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/faculty-profiles/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adviserToken}`,
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Professional profile updated successfully");
    expect(body.profile).toBeDefined();
    expect(body.profile.academicTitle).toBe("Ph.D., PE");
    expect(body.profile.educations).toHaveLength(1);
    expect(body.completion.percentage).toBeGreaterThanOrEqual(85);
  });

  it("GET /api/faculty-profiles/:userId allows students to view verified adviser CV while stripping sensitive fields", async () => {
    const res = await fetch(`${baseUrl}/api/faculty-profiles/${adviserUser.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.adviser).toBeDefined();
    expect(body.adviser.name).toBeDefined();
    expect(body.adviser.isVerified).toBe(true);
    expect(body.adviser.capacity).toBeDefined();
    expect(body.adviser.profile).toBeDefined();

    const profile = body.adviser.profile;
    expect(profile.academicTitle).toBe("Ph.D., PE");
    expect(profile.educations).toHaveLength(1);
    expect(profile.educations[0].degreeName).toBe("Ph.D. in Computer Science");

    // Verify privacy protection: licenseNumber must NOT be exposed to students!
    expect(profile.certifications).toHaveLength(1);
    expect(profile.certifications[0].title).toBe("AWS Certified Solutions Architect - Professional");
    expect(profile.certifications[0].licenseNumber).toBeUndefined();
  });

  it("Denies students from modifying faculty profiles via PUT /api/faculty-profiles/me", async () => {
    const res = await fetch(`${baseUrl}/api/faculty-profiles/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ biography: "Malicious attempt by student" }),
    });

    expect(res.status).toBe(403);
  });

  it("Enforces college scoping by denying students from viewing out-of-college advisers", async () => {
    if (!otherCollegeToken) return;
    const res = await fetch(`${baseUrl}/api/faculty-profiles/${adviserUser.id}`, {
      headers: { Authorization: `Bearer ${otherCollegeToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error).toContain("different college");
  });
});
