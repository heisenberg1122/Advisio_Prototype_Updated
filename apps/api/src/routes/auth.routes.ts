import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@research-management/validations";
import {
  requestPasswordRecovery,
  resetPassword,
} from "../services/password-recovery.service.js";
import {
  loginRateLimit,
  recoveryRateLimit,
} from "../middleware/recovery-rate-limit.js";
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import {
  prisma,
  type AppearancePreference,
  type ColorThemePreference,
} from "../lib/prisma.js";
import { researchInterestsForProgram } from "@research-management/database";
import {
  effectiveColorThemePreference,
  parseColorThemePreference,
} from "../lib/appearance-preference.js";
import {
  loginSchema,
  registerSchema,
  researcherOnboardingSchema,
} from "@research-management/validations";
import { validateBody } from "../middleware/validate";
import { requireAuth, generateToken } from "../middleware/auth";

const router = Router();
const googleSignInClient = new OAuth2Client();

router.post(
  "/forgot-password",
  recoveryRateLimit,
  validateBody(forgotPasswordSchema),
  async (req, res) => {
    try {
      res.json({ message: await requestPasswordRecovery(req.body.email) });
    } catch (error: any) {
      res.status(error.statusCode || 503).json({
        error: error.statusCode
          ? error.message
          : "Password recovery is temporarily unavailable.",
      });
    }
  },
);

router.post(
  "/reset-password",
  recoveryRateLimit,
  validateBody(resetPasswordSchema),
  async (req, res) => {
    try {
      await resetPassword(req.body.token, req.body.newPassword);
      res.json({
        message:
          "Your password has been reset. Sign in with your new password.",
      });
    } catch (error: any) {
      res.status(error.statusCode || 503).json({
        error: error.statusCode
          ? error.message
          : "Password recovery is temporarily unavailable.",
      });
    }
  },
);

// POST /api/auth/register
router.post(
  "/register",
  validateBody(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        universityId,
        email,
        firstName,
        middleName,
        lastName,
        password,
        collegeId,
        programId,
        role,
      } = req.body;

      const normalizedEmail = email.toLowerCase().trim();
      const requestedRole = String(role || "RESEARCHER").toUpperCase();
      const isResearcher = requestedRole === "RESEARCHER";

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: normalizedEmail }, { universityId }],
        },
      });

      if (existingUser) {
        const isEmailMatch =
          existingUser.email.toLowerCase() === normalizedEmail;
        const matchLabel = isEmailMatch
          ? `email address (${normalizedEmail})`
          : `University ID (${universityId})`;
        res.status(409).json({
          error: `An account with this ${matchLabel} already exists. If this is your account, please sign in or contact the system administrator.`,
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

        if (
          !selectedProgram ||
          (collegeId && collegeId !== selectedProgram.collegeId)
        ) {
          res.status(400).json({
            error: "The selected program is not available for that college.",
          });
          return;
        }

        resolvedProgramId = selectedProgram.id;
        resolvedCollegeId = selectedProgram.collegeId;
      } else {
        if (!collegeId) {
          res
            .status(400)
            .json({ error: "Select your assigned college or school." });
          return;
        }
        const selectedCollege = await prisma.college.findFirst({
          where: { id: collegeId, isActive: true },
          select: { id: true },
        });
        if (!selectedCollege) {
          res
            .status(400)
            .json({ error: "The selected college or school is unavailable." });
          return;
        }
        resolvedCollegeId = selectedCollege.id;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const initialStatus = "PENDING";
      const onboardingToken = isResearcher
        ? randomBytes(32).toString("hex")
        : null;
      const onboardingTokenHash = onboardingToken
        ? createHash("sha256").update(onboardingToken).digest("hex")
        : null;

      const roleName = isResearcher ? "RESEARCHER" : "ADVISER";
      const targetRole = await prisma.role.findUnique({
        where: { name: roleName },
      });
      if (!targetRole)
        return void res
          .status(503)
          .json({ error: "Registration is temporarily unavailable." });
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
          onboardingTokenExpiresAt: onboardingToken
            ? new Date(Date.now() + 24 * 60 * 60 * 1000)
            : null,
          roles: { create: { roleId: targetRole.id } },
        },
      });

      if (initialStatus === "PENDING") {
        res.status(201).json({
          message:
            "Account created successfully. Your account is pending verification and approval. You will be able to log in once approved.",
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
    } catch {
      res
        .status(500)
        .json({ error: "Registration is temporarily unavailable." });
    }
  },
);

// POST /api/auth/researcher-onboarding
// Completes a pending researcher's academic profile using the short-lived token
// issued during registration. This does not activate the account.
router.post(
  "/researcher-onboarding",
  validateBody(researcherOnboardingSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        onboardingToken,
        collegeId,
        programId,
        academicYearId,
        ...profile
      } = req.body;
      const tokenHash = createHash("sha256")
        .update(onboardingToken)
        .digest("hex");

      const user = await prisma.user.findFirst({
        where: {
          onboardingTokenHash: tokenHash,
          onboardingTokenExpiresAt: { gt: new Date() },
          status: "PENDING",
          roles: { some: { role: { name: "RESEARCHER" } } },
        },
      });

      if (!user) {
        res.status(401).json({
          error:
            "This onboarding link is invalid or has expired. Please register again or contact the administrator.",
        });
        return;
      }

      if (
        (user.programId && user.programId !== programId) ||
        (user.collegeId && user.collegeId !== collegeId)
      ) {
        res.status(400).json({
          error:
            "Your verified registration program cannot be changed during onboarding.",
        });
        return;
      }

      const resolvedProgramId = user.programId || programId;
      const resolvedCollegeId = user.collegeId || collegeId;
      const [program, academicYear] = await Promise.all([
        prisma.program.findFirst({
          where: {
            id: resolvedProgramId,
            collegeId: resolvedCollegeId,
            isActive: true,
            college: { isActive: true },
          },
        }),
        prisma.academicYear.findFirst({
          where: { id: academicYearId, isActive: true },
        }),
      ]);

      if (!program) {
        res.status(400).json({
          error:
            "The selected program does not belong to the selected college.",
        });
        return;
      }
      if (!academicYear) {
        res
          .status(400)
          .json({ error: "The selected academic year is unavailable." });
        return;
      }

      const allowedInterests = new Set(
        researchInterestsForProgram(program.code),
      );
      if (
        profile.interests.some(
          (interest: string) => !allowedInterests.has(interest),
        )
      ) {
        res.status(400).json({
          error:
            "Choose research interests available for your verified program.",
        });
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
    } catch {
      res
        .status(500)
        .json({ error: "Researcher onboarding is temporarily unavailable." });
    }
  },
);

// POST /api/auth/login
router.post(
  "/login",
  loginRateLimit,
  validateBody(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = (email || "").toLowerCase().trim();

      let user = null;
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
      } catch {
        res.status(503).json({
          error: "The account service is temporarily unavailable.",
        });
        return;
      }

      if (!user || !user.passwordHash) {
        res.status(401).json({
          error:
            "Invalid email or password. Please verify your credentials or register.",
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
          error:
            "Your account is pending verification and approval. Please contact the system administrator if you need assistance.",
          status: "PENDING",
        });
        return;
      }

      if (user.status === "SUSPENDED") {
        res.status(403).json({
          error:
            "Your account has been suspended. Please contact the system administrator.",
          status: "SUSPENDED",
        });
        return;
      }

      if (user.status !== "ACTIVE") {
        res.status(403).json({
          error:
            "Your account is not active. Please contact the system administrator.",
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

      const token = generateToken(user.id, user.sessionVersion);

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
    } catch {
      res
        .status(500)
        .json({ error: "The account service is temporarily unavailable." });
    }
  },
);

// POST /api/auth/google
// Verifies a Google Identity Services ID token and issues an Advisio session.
router.post("/google", async (req: Request, res: Response) => {
  try {
    const clientId = process.env.GOOGLE_SIGN_IN_CLIENT_ID?.trim();
    const idToken =
      typeof req.body?.credential === "string" ? req.body.credential : "";
    if (!clientId) {
      return void res
        .status(503)
        .json({ error: "Google sign-in is not configured." });
    }
    if (!idToken) {
      return void res
        .status(400)
        .json({ error: "A Google sign-in credential is required." });
    }

    const ticket = await googleSignInClient
      .verifyIdToken({ idToken, audience: clientId })
      .catch(() => null);
    if (!ticket) {
      return void res.status(401).json({
        error: "Google sign-in could not be verified. Please try again.",
      });
    }
    const identity = ticket.getPayload();
    if (!identity?.sub || !identity.email || identity.email_verified !== true) {
      return void res
        .status(401)
        .json({ error: "Google did not provide a verified email address." });
    }

    const email = identity.email.trim().toLowerCase();
    const includeRoles = { roles: { include: { role: true } } } as const;
    let user = await prisma.user.findUnique({
      where: { googleSubject: identity.sub },
      include: includeRoles,
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email },
        include: includeRoles,
      });
      if (user) {
        if (user.googleSubject && user.googleSubject !== identity.sub) {
          return void res.status(409).json({
            error:
              "This Advisio account is already linked to a different Google account.",
          });
        }
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleSubject: identity.sub, lastLoginAt: new Date() },
          include: includeRoles,
        });
      }
    }

    if (!user) {
      if (process.env.GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP !== "true") {
        return void res.status(403).json({
          error:
            "No Advisio account is linked to this Google email. Ask an administrator to enable test sign-up or register first.",
        });
      }

      const researcherRole = await prisma.role.findUnique({
        where: { name: "RESEARCHER" },
      });
      if (!researcherRole) {
        return void res
          .status(503)
          .json({ error: "Researcher accounts are not available right now." });
      }

      const firstName =
        identity.given_name?.trim() ||
        identity.name?.trim().split(/\s+/)[0] ||
        "Google";
      const lastName =
        identity.family_name?.trim() ||
        identity.name?.trim().split(/\s+/).slice(1).join(" ") ||
        "Researcher";
      user = await prisma.user.create({
        data: {
          universityId: `TEST-${randomUUID().replace(/-/g, "")}`,
          email,
          googleSubject: identity.sub,
          firstName: firstName.slice(0, 100),
          lastName: lastName.slice(0, 100),
          status: "ACTIVE",
          lastLoginAt: new Date(),
          roles: { create: { roleId: researcherRole.id } },
        },
        include: includeRoles,
      });
    } else if (user.status !== "ACTIVE") {
      const message =
        user.status === "PENDING"
          ? "Your Advisio account is pending approval. Please contact an administrator."
          : user.status === "SUSPENDED"
            ? "Your Advisio account is suspended. Please contact an administrator."
            : "Your Advisio account is not active. Please contact an administrator.";
      return void res.status(403).json({ error: message, status: user.status });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const token = generateToken(user.id, user.sessionVersion);
    return void res.json({
      message: "Google sign-in successful",
      token,
      needsAcademicSetup:
        user.roles.some((userRole) => userRole.role.name === "RESEARCHER") &&
        (!user.collegeId || !user.programId),
      user: {
        id: user.id,
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map((userRole) => userRole.role.name),
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return void res.status(409).json({
        error: "An account already exists for this Google identity or email.",
      });
    }
    console.error("Google sign-in failed.");
    return void res.status(500).json({
      error: "Google sign-in is temporarily unavailable. Please try again.",
    });
  }
});

// PATCH /api/auth/google/academic-profile
// Lets newly created Google researchers choose their academic affiliation before entering the dashboard.
router.patch(
  "/google/academic-profile",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Authentication required" });
      const collegeId =
        typeof req.body?.collegeId === "string" ? req.body.collegeId : "";
      const programId =
        typeof req.body?.programId === "string" ? req.body.programId : "";
      if (!collegeId || !programId) {
        return void res
          .status(400)
          .json({ error: "Choose a department and course." });
      }

      const account = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { roles: { include: { role: true } } },
      });
      if (
        !account ||
        !account.googleSubject ||
        !account.roles.some((item) => item.role.name === "RESEARCHER")
      ) {
        return void res.status(403).json({
          error:
            "This setup is available to new Google researcher accounts only.",
        });
      }
      if (account.collegeId && account.collegeId !== collegeId) {
        return void res.status(403).json({
          error: "Your account already has a different department assigned.",
        });
      }
      if (account.programId && account.programId !== programId) {
        return void res.status(403).json({
          error: "Your account already has a different course assigned.",
        });
      }

      const program = await prisma.program.findFirst({
        where: {
          id: programId,
          collegeId,
          isActive: true,
          college: { isActive: true },
        },
        select: { id: true },
      });
      if (!program)
        return void res.status(400).json({
          error: "Choose an active course within the selected department.",
        });

      await prisma.user.update({
        where: { id: account.id },
        data: { collegeId, programId },
      });
      return void res.json({ message: "Academic profile saved." });
    } catch {
      console.error("Google researcher academic setup failed.");
      return void res.status(500).json({
        error: "Could not save your academic profile. Please try again.",
      });
    }
  },
);

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
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
        colorThemePreference: effectiveColorThemePreference(
          user.colorThemePreference,
          req.user.roles,
        ),
        roles: req.user.roles,
        permissions: req.user.permissions,
      },
    });
  } catch {
    res
      .status(500)
      .json({ error: "The user profile is temporarily unavailable." });
  }
});

// PATCH /api/auth/me/appearance
router.patch(
  "/me/appearance",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const hasAppearancePreference = Object.prototype.hasOwnProperty.call(
        req.body,
        "appearancePreference",
      );
      const hasColorThemePreference = Object.prototype.hasOwnProperty.call(
        req.body,
        "colorThemePreference",
      );

      if (!hasAppearancePreference && !hasColorThemePreference) {
        res.status(400).json({
          error: "Provide an appearance or color theme preference.",
        });
        return;
      }

      let appearancePreference: AppearancePreference | undefined;
      if (hasAppearancePreference) {
        const requestedAppearance = String(
          req.body.appearancePreference || "",
        ).toUpperCase();
        if (
          !(["LIGHT", "DARK", "SYSTEM"] as const).includes(
            requestedAppearance as AppearancePreference,
          )
        ) {
          res.status(400).json({
            error: "Appearance must be LIGHT, DARK, or SYSTEM.",
          });
          return;
        }
        appearancePreference = requestedAppearance as AppearancePreference;
      }

      let requestedColorTheme: ColorThemePreference | undefined;
      if (hasColorThemePreference) {
        requestedColorTheme =
          parseColorThemePreference(req.body.colorThemePreference) || undefined;
        if (!requestedColorTheme) {
          res.status(400).json({
            error: "Color theme must be DEFAULT_ADVISIO or COLLEGE_PROGRAM.",
          });
          return;
        }
      }

      const colorThemePreference = effectiveColorThemePreference(
        requestedColorTheme || "COLLEGE_PROGRAM",
        req.user.roles,
      );

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(appearancePreference ? { appearancePreference } : {}),
          ...(hasColorThemePreference || req.user.roles.includes("SYSTEM_ADMIN")
            ? { colorThemePreference }
            : {}),
        },
        select: { appearancePreference: true, colorThemePreference: true },
      });

      res.json({
        appearancePreference: user.appearancePreference,
        colorThemePreference: effectiveColorThemePreference(
          user.colorThemePreference,
          req.user.roles,
        ),
      });
    } catch {
      res
        .status(500)
        .json({ error: "Could not save the appearance preference." });
    }
  },
);

export default router;
