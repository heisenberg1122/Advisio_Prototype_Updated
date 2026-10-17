import { Router, Request, Response } from "express";
import { prisma, AuditAction, InstitutionalRole } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { countActiveAdviseeGroups, capacitySummary } from "../lib/adviser-capacity.js";
import { getCollegeScope } from "../lib/college-scope.js";
import {
  facultyProfileUpdateSchema,
  calculateProfileCompletion,
  type FacultyProfileUpdateInput,
} from "@research-management/validations";

const router = Router();

function sanitizeString(val: string | null | undefined): string | null {
  if (typeof val !== "string") return null;
  const cleaned = val.replace(/<[^>]*>?/gm, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeStringArray(arr: string[] | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => (typeof s === "string" ? s.replace(/<[^>]*>?/gm, "").trim() : ""))
    .filter((s) => s.length > 0);
}

function sanitizeProfileData(input: FacultyProfileUpdateInput) {
  return {
    academicTitle: sanitizeString(input.academicTitle),
    facultyDesignation: sanitizeString(input.facultyDesignation),
    department: sanitizeString(input.department),
    photoUrl: sanitizeString(input.photoUrl),
    biography: sanitizeString(input.biography),
    teachingBackground: sanitizeString(input.teachingBackground),
    mentoringPhilosophy: sanitizeString(input.mentoringPhilosophy),
    preferredProjectTypes: sanitizeString(input.preferredProjectTypes),
    expertiseKeywords: sanitizeStringArray(input.expertiseKeywords),
    researchInterests: sanitizeStringArray(input.researchInterests),
    specializedTopics: sanitizeStringArray(input.specializedTopics),
    supervisionMethodologies: sanitizeStringArray(input.supervisionMethodologies),
    acceptedResearchTypes: sanitizeStringArray(input.acceptedResearchTypes),
    advisingPreferences: sanitizeString(input.advisingPreferences),
    educations: Array.isArray(input.educations)
      ? input.educations.map((edu) => ({
          ...edu,
          degreeName: edu.degreeName.trim(),
          fieldOfStudy: edu.fieldOfStudy.trim(),
          institution: edu.institution.trim(),
        }))
      : [],
    certifications: Array.isArray(input.certifications)
      ? input.certifications.map((cert) => ({
          ...cert,
          title: cert.title.trim(),
          issuingBody: cert.issuingBody.trim(),
          licenseNumber: sanitizeString(cert.licenseNumber),
        }))
      : [],
    experiences: Array.isArray(input.experiences)
      ? input.experiences.map((exp) => ({
          ...exp,
          title: exp.title.trim(),
          organization: exp.organization.trim(),
          description: sanitizeString(exp.description),
        }))
      : [],
    publications: Array.isArray(input.publications)
      ? input.publications.map((pub) => ({
          ...pub,
          title: pub.title.trim(),
          venue: pub.venue.trim(),
          authors: sanitizeString(pub.authors),
          url: sanitizeString(pub.url),
        }))
      : [],
    awards: Array.isArray(input.awards)
      ? input.awards.map((award) => ({
          ...award,
          title: award.title.trim(),
          issuingOrganization: award.issuingOrganization.trim(),
          description: sanitizeString(award.description),
        }))
      : [],
  };
}

// GET /api/faculty-profiles/me — authenticated adviser views and manages their own profile
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const isAdviser = req.user.roles.includes("ADVISER") || req.user.roles.includes("SYSTEM_ADMIN");
    if (!isAdviser) {
      res.status(403).json({ error: "Adviser access is required to view faculty profile" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        college: true,
        program: true,
        facultyProfile: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const activeGroups = await countActiveAdviseeGroups(prisma, user.id);
    const capacity = {
      ...capacitySummary(user, activeGroups),
      note: user.adviserCapacityNote,
      updatedAt: user.adviserCapacitySetAt,
    };

    const completion = calculateProfileCompletion(user.facultyProfile as any);

    res.json({
      profile: user.facultyProfile || null,
      user: {
        id: user.id,
        email: user.email,
        universityId: user.universityId,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        college: user.college,
        program: user.program,
        status: user.status,
      },
      capacity,
      completion,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch faculty profile" });
  }
});

// PUT /api/faculty-profiles/me — authenticated adviser updates their own profile
router.put("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const isAdviser = req.user.roles.includes("ADVISER") || req.user.roles.includes("SYSTEM_ADMIN");
    if (!isAdviser) {
      res.status(403).json({ error: "Only authorized advisers may edit their professional profile" });
      return;
    }

    const parsed = facultyProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid faculty profile data",
        details: parsed.error.flatten(),
      });
      return;
    }

    const sanitized = sanitizeProfileData(parsed.data);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.facultyProfile.findUnique({
        where: { userId: req.user!.id },
      });

      const updated = await tx.facultyProfile.upsert({
        where: { userId: req.user!.id },
        create: {
          userId: req.user!.id,
          ...sanitized,
        },
        update: sanitized,
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: AuditAction.UPDATE,
          entityType: "FACULTY_PROFILE",
          entityId: req.user!.id,
          oldValues: existing ? (JSON.parse(JSON.stringify(existing))) : undefined,
          newValues: sanitized,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return updated;
    });

    const completion = calculateProfileCompletion(result as any);

    res.json({
      message: "Professional profile updated successfully",
      profile: result,
      completion,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update faculty profile" });
  }
});

// GET /api/faculty-profiles/:userId — public / student view of a verified adviser's CV
router.get("/:userId", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        roles: {
          some: {
            role: {
              name: InstitutionalRole.ADVISER,
            },
          },
        },
        status: "ACTIVE",
      },
      include: {
        college: true,
        program: true,
        facultyProfile: true,
      },
    });

    if (!targetUser) {
      res.status(404).json({ error: "Verified adviser not found or currently unavailable" });
      return;
    }

    // Check college scope if applicable
    const scope = getCollegeScope(req.user);
    if (scope.kind === "college" && targetUser.collegeId && targetUser.collegeId !== scope.collegeId) {
      res.status(403).json({ error: "Adviser is from a different college" });
      return;
    }

    // Authoritative advising capacity calculated directly from active research members
    const activeGroups = await countActiveAdviseeGroups(prisma, targetUser.id);
    const capacity = capacitySummary(targetUser, activeGroups);

    // Privacy Protection: Strip confidential fields (e.g. licenseNumber) from certifications
    const profile = targetUser.facultyProfile;
    const sanitizedCertifications = Array.isArray(profile?.certifications)
      ? (profile.certifications as any[]).map(({ licenseNumber: _lic, ...cert }) => cert)
      : [];

    const publicProfile = profile
      ? {
          academicTitle: profile.academicTitle,
          facultyDesignation: profile.facultyDesignation,
          department: profile.department,
          photoUrl: profile.photoUrl,
          biography: profile.biography,
          teachingBackground: profile.teachingBackground,
          mentoringPhilosophy: profile.mentoringPhilosophy,
          preferredProjectTypes: profile.preferredProjectTypes,
          expertiseKeywords: profile.expertiseKeywords,
          researchInterests: profile.researchInterests,
          specializedTopics: profile.specializedTopics,
          supervisionMethodologies: profile.supervisionMethodologies,
          acceptedResearchTypes: profile.acceptedResearchTypes,
          advisingPreferences: profile.advisingPreferences,
          educations: profile.educations || [],
          certifications: sanitizedCertifications,
          experiences: profile.experiences || [],
          publications: profile.publications || [],
          awards: profile.awards || [],
        }
      : null;

    res.json({
      adviser: {
        id: targetUser.id,
        name: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email,
        college: targetUser.college?.name || targetUser.college?.code || null,
        collegeId: targetUser.collegeId,
        program: targetUser.program?.name || targetUser.program?.code || null,
        programId: targetUser.programId,
        isVerified: targetUser.status === "ACTIVE",
        capacity,
        profile: publicProfile,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load adviser profile" });
  }
});

export default router;
