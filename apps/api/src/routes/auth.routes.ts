import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { prisma, type InstitutionalRole } from "../lib/prisma.js";
import { loginSchema, registerSchema, researcherOnboardingSchema } from "@research-management/validations";
import { validateBody } from "../middleware/validate";
import { requireAuth, generateToken } from "../middleware/auth";

const router = Router();

// POST /api/auth/register
router.post("/register", validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { universityId, email, firstName, middleName, lastName, password, collegeId, programId, role } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const requestedRole = String(role || "RESEARCHER").toUpperCase();
    const isResearcher = requestedRole === "RESEARCHER";

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { universityId }],
      },
    });

    if (existingUser) {
      const isEmailMatch = existingUser.email.toLowerCase() === normalizedEmail;
      const matchLabel = isEmailMatch 
        ? `email address (${normalizedEmail})` 
        : `University ID (${universityId})`;
      res.status(409).json({ 
        error: `An account with this ${matchLabel} already exists. If this is your account, please sign in or contact admin01@university.edu.ph.` 
      });
      return;
    }

    let resolvedCollegeId: string | null = null;
    let resolvedProgramId: string | null = null;

    if (isResearcher) {
      if (!programId) {
        res.status(400).json({ error: "Select an active academic program." });
        return;
      }

      const selectedProgram = await prisma.program.findFirst({
        where: {
          id: programId,
          isActive: true,
          college: { isActive: true },
        },
        select: { id: true, collegeId: true },
      });

      if (!selectedProgram || (collegeId && collegeId !== selectedProgram.collegeId)) {
        res.status(400).json({ error: "The selected program is not available for that college." });
        return;
      }

      resolvedProgramId = selectedProgram.id;
      resolvedCollegeId = selectedProgram.collegeId;
    } else {
      if (!collegeId) {
        res.status(400).json({ error: "Select your assigned college or school." });
        return;
      }
      const selectedCollege = await prisma.college.findFirst({
        where: { id: collegeId, isActive: true },
        select: { id: true },
      });
      if (!selectedCollege) {
        res.status(400).json({ error: "The selected college or school is unavailable." });
        return;
      }
      resolvedCollegeId = selectedCollege.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const isAdmin = normalizedEmail === "admin01@university.edu.ph" || normalizedEmail.includes("admin");
    const initialStatus = isAdmin ? "ACTIVE" : "PENDING";
    const onboardingToken = isResearcher ? randomBytes(32).toString("hex") : null;
    const onboardingTokenHash = onboardingToken
      ? createHash("sha256").update(onboardingToken).digest("hex")
      : null;

    const user = await prisma.user.create({
      data: {
        universityId,
        email: normalizedEmail,
        firstName,
        middleName,
        lastName,
        passwordHash,
        collegeId: resolvedCollegeId,
        programId: resolvedProgramId,
        status: initialStatus,
        onboardingTokenHash,
        onboardingTokenExpiresAt: onboardingToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      },
    });

    // Assign institutional role based on request or email
    let roleName: any = "RESEARCHER";
    if (isAdmin) {
      roleName = "SYSTEM_ADMIN";
    } else if (role && ["ADVISER", "PANELIST", "RESEARCH_COORDINATOR", "RESEARCHER"].includes(role.toUpperCase())) {
      roleName = role.toUpperCase();
    } else if (normalizedEmail.includes("adviser") || normalizedEmail.includes("faculty")) {
      roleName = "ADVISER";
    }

    const targetRole = await prisma.role.findFirst({
      where: { name: roleName },
    });

    if (targetRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: targetRole.id,
        },
      });
    }

    if (initialStatus === "PENDING") {
      res.status(201).json({
        message: "Account created successfully. Your account is pending verification and approval by the administrator (admin01@university.edu.ph). You will be able to log in once approved.",
        status: "PENDING",
        user: {
          id: user.id,
          universityId: user.universityId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          collegeId: user.collegeId,
          programId: user.programId,
          status: "PENDING",
        },
        onboardingToken,
      });
      return;
    }

    const token = generateToken(user.id);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to register user" });
  }
});

// POST /api/auth/researcher-onboarding
// Completes a pending researcher's academic profile using the short-lived token
// issued during registration. This does not activate the account.
router.post(
  "/researcher-onboarding",
  validateBody(researcherOnboardingSchema),
  async (req: Request, res: Response) => {
    try {
      const { onboardingToken, collegeId, programId, academicYearId, ...profile } = req.body;
      const tokenHash = createHash("sha256").update(onboardingToken).digest("hex");

      const user = await prisma.user.findFirst({
        where: {
          onboardingTokenHash: tokenHash,
          onboardingTokenExpiresAt: { gt: new Date() },
          status: "PENDING",
          roles: { some: { role: { name: "RESEARCHER" } } },
        },
      });

      if (!user) {
        res.status(401).json({ error: "This onboarding link is invalid or has expired. Please register again or contact the administrator." });
        return;
      }

      if (
        (user.programId && user.programId !== programId) ||
        (user.collegeId && user.collegeId !== collegeId)
      ) {
        res.status(400).json({ error: "Your verified registration program cannot be changed during onboarding." });
        return;
      }

      const resolvedProgramId = user.programId || programId;
      const resolvedCollegeId = user.collegeId || collegeId;
      const [program, academicYear] = await Promise.all([
        prisma.program.findFirst({ where: { id: resolvedProgramId, collegeId: resolvedCollegeId, isActive: true, college: { isActive: true } } }),
        prisma.academicYear.findFirst({ where: { id: academicYearId, isActive: true } }),
      ]);

      if (!program) {
        res.status(400).json({ error: "The selected program does not belong to the selected college." });
        return;
      }
      if (!academicYear) {
        res.status(400).json({ error: "The selected academic year is unavailable." });
        return;
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            collegeId: resolvedCollegeId,
            programId: resolvedProgramId,
            onboardingTokenHash: null,
            onboardingTokenExpiresAt: null,
          },
        }),
        prisma.researcherProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            academicYearId,
            ...profile,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
          update: {
            academicYearId,
            ...profile,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
        }),
      ]);

      res.json({
        message: "Researcher profile submitted for verification.",
        status: "SUBMITTED",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to submit researcher onboarding" });
    }
  },
);

// POST /api/auth/login
router.post("/login", validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || "").toLowerCase().trim();
    const demoProvisioningEnabled =
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEMO_ACCOUNT_PROVISIONING === "true";
    const demoAccountPassword = process.env.DEMO_ACCOUNT_PASSWORD;

    let user = null;
    let databaseLookupFailed = false;
    try {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    } catch (dbError) {
      databaseLookupFailed = true;
      console.error("Database lookup failed during login:", dbError);
    }

    if (!user || !user.passwordHash) {
      const demoAccounts: Record<string, { role: InstitutionalRole; firstName: string; lastName: string; universityId: string }> = {
        // Students / Researchers
        "student01@university.edu.ph": { role: "RESEARCHER", firstName: "Student", lastName: "Researcher", universityId: "STUDENT-DEMO-001" },
        "student@advisio.edu.ph": { role: "RESEARCHER", firstName: "Juan", lastName: "Reyes", universityId: "STUDENT-001" },
        "student02@university.edu.ph": { role: "RESEARCHER", firstName: "Mateo", lastName: "Alvarez", universityId: "STUDENT-DEMO-002" },
        "student03@university.edu.ph": { role: "RESEARCHER", firstName: "Beatrice", lastName: "Cruz", universityId: "STUDENT-DEMO-003" },
        "student04@university.edu.ph": { role: "RESEARCHER", firstName: "Gabriel", lastName: "Santos", universityId: "STUDENT-DEMO-004" },
        "student05@university.edu.ph": { role: "RESEARCHER", firstName: "Alyssa", lastName: "Dizon", universityId: "STUDENT-DEMO-005" },
        "researcher01@university.edu.ph": { role: "RESEARCHER", firstName: "Carlos", lastName: "Mendoza", universityId: "RES-DEMO-001" },
        "researcher02@university.edu.ph": { role: "RESEARCHER", firstName: "Patricia", lastName: "Reyes", universityId: "RES-DEMO-002" },

        // Advisers
        "adviser01@university.edu.ph": { role: "ADVISER", firstName: "Faculty", lastName: "Adviser", universityId: "ADVISER-DEMO-001" },
        "adviser@advisio.edu.ph": { role: "ADVISER", firstName: "Rachel", lastName: "Lim", universityId: "ADVISER-001" },
        "adviser02@university.edu.ph": { role: "ADVISER", firstName: "Dr. Ramon", lastName: "Bautista", universityId: "ADVISER-DEMO-002" },
        "adviser03@university.edu.ph": { role: "ADVISER", firstName: "Prof. Teresa", lastName: "Mercado", universityId: "ADVISER-DEMO-003" },
        "adviser04@university.edu.ph": { role: "ADVISER", firstName: "Dr. Antonio", lastName: "Villanueva", universityId: "ADVISER-DEMO-004" },
        "adviser05@university.edu.ph": { role: "ADVISER", firstName: "Prof. Carmen", lastName: "Salazar", universityId: "ADVISER-DEMO-005" },

        // Coordinators / Professors
        "professor01@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Maria Clara", lastName: "Santos", universityId: "PROFESSOR-DEMO-001" },
        "prof.santos@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Maria Clara", lastName: "Santos", universityId: "PROFESSOR-DEMO-001" },
        "professor02@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Arthur", lastName: "Pendelton", universityId: "PROFESSOR-DEMO-002" },
        "prof.pendelton@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Arthur", lastName: "Pendelton", universityId: "PROFESSOR-DEMO-002" },
        "professor03@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Elena", lastName: "Rostova", universityId: "PROFESSOR-DEMO-003" },
        "prof.rostova@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Elena", lastName: "Rostova", universityId: "PROFESSOR-DEMO-003" },
        "professor04@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Marcus", lastName: "Vance", universityId: "PROFESSOR-DEMO-004" },
        "prof.vance@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Marcus", lastName: "Vance", universityId: "PROFESSOR-DEMO-004" },
        "professor05@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Sophia", lastName: "Delgado", universityId: "PROFESSOR-DEMO-005" },
        "prof.delgado@university.edu.ph": { role: "RESEARCH_COORDINATOR", firstName: "Sophia", lastName: "Delgado", universityId: "PROFESSOR-DEMO-005" },

        // Panelists
        "panelist01@university.edu.ph": { role: "PANELIST", firstName: "Defense", lastName: "Panelist", universityId: "PANELIST-DEMO-001" },
        "panelist02@university.edu.ph": { role: "PANELIST", firstName: "Dr. Fernando", lastName: "Gomez", universityId: "PANELIST-DEMO-002" },
        "panelist03@university.edu.ph": { role: "PANELIST", firstName: "Prof. Lilian", lastName: "Morales", universityId: "PANELIST-DEMO-003" },
        "panelist04@university.edu.ph": { role: "PANELIST", firstName: "Dr. Eduardo", lastName: "Castillo", universityId: "PANELIST-DEMO-004" },
        "panelist05@university.edu.ph": { role: "PANELIST", firstName: "Prof. Victoria", lastName: "Navarro", universityId: "PANELIST-DEMO-005" },

        // Deans & Admin
        "dean01@university.edu.ph": { role: "RPO", firstName: "Dr. Manuel", lastName: "Soriano", universityId: "DEAN-DEMO-001" },
        "dean.cit@university.edu.ph": { role: "RPO", firstName: "Dr. Angelica", lastName: "Flores", universityId: "DEAN-DEMO-002" },
        "dean@advisio.edu.ph": { role: "RPO", firstName: "Dr. Ernesto", lastName: "Valerio", universityId: "DEAN-001" },
        "admin01@university.edu.ph": { role: "RPO", firstName: "Admin", lastName: "Officer", universityId: "ADMIN-001" },
        "superadmin01@university.edu.ph": { role: "SYSTEM_ADMIN", firstName: "System", lastName: "Administrator", universityId: "SYSADMIN-001" },
        "admin@advisio.edu.ph": { role: "SYSTEM_ADMIN", firstName: "System", lastName: "Administrator", universityId: "SYSADMIN-002" },
      };
      const demoAccount = demoProvisioningEnabled
        ? demoAccounts[normalizedEmail]
        : undefined;

      if (demoAccount) {
        if (!demoAccountPassword || password !== demoAccountPassword) {
          res.status(401).json({ error: "Invalid email or password" });
          return;
        }

        try {
          const passwordHash = await bcrypt.hash(demoAccountPassword, 10);
          const firstName = demoAccount.firstName;
          const lastName = demoAccount.lastName;
          const roleName = demoAccount.role;

          const roleRecord = await prisma.role.findFirst({ where: { name: roleName } });
          const newUser = await prisma.user.create({
            data: {
              universityId: demoAccount.universityId || `UA-${Date.now().toString().slice(-6)}`,
              email: normalizedEmail,
              firstName,
              lastName,
              passwordHash,
              status: "ACTIVE",
              ...(roleRecord && {
                roles: {
                  create: { roleId: roleRecord.id },
                },
              }),
            },
            include: { roles: { include: { role: true } } },
          });

          const token = generateToken(newUser.id);
          res.json({
            message: "Login successful (Provisioned)",
            token,
            user: {
              id: newUser.id,
              universityId: newUser.universityId,
              email: newUser.email,
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              roles: newUser.roles.map((r) => r.role.name),
            },
          });
          return;
        } catch (provisioningError) {
          console.error("Demo account provisioning failed:", provisioningError);
          res.status(503).json({
            error: "The account service is temporarily unavailable.",
          });
          return;
        }
      }

      res.status(databaseLookupFailed ? 503 : 401).json({
        error: databaseLookupFailed
          ? "The account service is temporarily unavailable."
          : "Invalid email or password. Please verify your credentials or register.",
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status === "PENDING") {
      res.status(403).json({
        error: "Your account is pending verification and approval by the administrator (admin01@university.edu.ph). Please wait for approval before logging in.",
        status: "PENDING",
      });
      return;
    }

    if (user.status === "SUSPENDED") {
      res.status(403).json({
        error: "Your account has been suspended. Please contact the administrator (admin01@university.edu.ph).",
        status: "SUSPENDED",
      });
      return;
    }

    if (user.status !== "ACTIVE") {
      res.status(403).json({
        error: "Your account is not active. Please contact the administrator (admin01@university.edu.ph).",
        status: user.status,
      });
      return;
    }

    // Update last login
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      // Non-critical update, ignore
    }

    const token = generateToken(user.id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map((r) => r.role.name),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to login" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.user.id.startsWith("demo-")) {
      res.json({
        user: {
          id: req.user.id,
          universityId: req.user.universityId,
          email: req.user.email,
          firstName: req.user.firstName || "Demo",
          middleName: null,
          lastName: req.user.lastName || "User",
          college: null,
          program: null,
          appearancePreference: "SYSTEM",
          roles: req.user.roles,
          permissions: req.user.permissions,
        },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        college: true,
        program: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        college: user.college,
        program: user.program,
        appearancePreference: user.appearancePreference,
        roles: req.user.roles,
        permissions: req.user.permissions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user profile" });
  }
});

// PATCH /api/auth/me/appearance
router.patch("/me/appearance", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const appearancePreference = String(req.body.appearancePreference || "").toUpperCase();
    if (!(["LIGHT", "DARK", "SYSTEM"] as const).includes(appearancePreference as any)) {
      res.status(400).json({ error: "Appearance must be LIGHT, DARK, or SYSTEM." });
      return;
    }

    if (req.user.id.startsWith("demo-")) {
      res.json({ appearancePreference });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { appearancePreference: appearancePreference as "LIGHT" | "DARK" | "SYSTEM" },
      select: { appearancePreference: true },
    });

    res.json({ appearancePreference: user.appearancePreference });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save appearance preference" });
  }
});

export default router;
