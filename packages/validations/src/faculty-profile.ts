import { z } from "zod";

export const degreeLevelEnum = z.enum([
  "BACHELORS",
  "MASTERS",
  "DOCTORATE",
  "POST_DOCTORATE",
  "OTHER",
]);
export type DegreeLevel = z.infer<typeof degreeLevelEnum>;

export const educationRecordSchema = z.object({
  id: z.string().min(1),
  degreeLevel: degreeLevelEnum,
  degreeName: z.string().trim().min(1, "Degree name is required").max(150),
  fieldOfStudy: z.string().trim().min(1, "Field of study is required").max(150),
  institution: z.string().trim().min(1, "Institution is required").max(200),
  graduationYear: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 5).nullable().optional(),
});
export type EducationRecord = z.infer<typeof educationRecordSchema>;

export const certificationRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Certification title is required").max(150),
  issuingBody: z.string().trim().min(1, "Issuing organization is required").max(150),
  yearIssued: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).nullable().optional(),
  licenseNumber: z.string().trim().max(100).nullable().optional(),
});
export type CertificationRecord = z.infer<typeof certificationRecordSchema>;

export const experienceTypeEnum = z.enum([
  "TEACHING",
  "INDUSTRY",
  "ADMINISTRATIVE",
  "RESEARCH",
]);
export type ExperienceType = z.infer<typeof experienceTypeEnum>;

export const experienceRecordSchema = z.object({
  id: z.string().min(1),
  type: experienceTypeEnum,
  title: z.string().trim().min(1, "Position or title is required").max(150),
  organization: z.string().trim().min(1, "Organization is required").max(150),
  startYear: z.union([z.coerce.number().int(), z.string().trim()]),
  endYear: z.union([z.coerce.number().int(), z.string().trim()]).nullable().optional(),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type ExperienceRecord = z.infer<typeof experienceRecordSchema>;

export const publicationRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Publication title is required").max(250),
  venue: z.string().trim().min(1, "Venue or journal is required").max(200),
  year: z.union([z.coerce.number().int(), z.string().trim()]).nullable().optional(),
  authors: z.string().trim().max(250).nullable().optional(),
  url: z.string().trim().url("Invalid URL format").or(z.literal("")).nullable().optional(),
});
export type PublicationRecord = z.infer<typeof publicationRecordSchema>;

export const awardRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Award title is required").max(150),
  issuingOrganization: z.string().trim().min(1, "Issuing organization is required").max(150),
  year: z.union([z.coerce.number().int(), z.string().trim()]).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type AwardRecord = z.infer<typeof awardRecordSchema>;

export const facultyProfileUpdateSchema = z.object({
  academicTitle: z.string().trim().max(100).nullable().optional(),
  facultyDesignation: z.string().trim().max(150).nullable().optional(),
  department: z.string().trim().max(150).nullable().optional(),
  photoUrl: z.string().trim().max(2000).nullable().optional(),
  biography: z.string().trim().max(3000).nullable().optional(),
  teachingBackground: z.string().trim().max(2000).nullable().optional(),
  mentoringPhilosophy: z.string().trim().max(2000).nullable().optional(),
  preferredProjectTypes: z.string().trim().max(1000).nullable().optional(),
  expertiseKeywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  researchInterests: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  specializedTopics: z.array(z.string().trim().min(1).max(150)).max(30).default([]),
  supervisionMethodologies: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  acceptedResearchTypes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  advisingPreferences: z.string().trim().max(2000).nullable().optional(),
  educations: z.array(educationRecordSchema).max(20).default([]),
  certifications: z.array(certificationRecordSchema).max(30).default([]),
  experiences: z.array(experienceRecordSchema).max(30).default([]),
  publications: z.array(publicationRecordSchema).max(50).default([]),
  awards: z.array(awardRecordSchema).max(30).default([]),
});
export type FacultyProfileUpdateInput = z.infer<typeof facultyProfileUpdateSchema>;

export interface ProfileCompletionResult {
  percentage: number;
  suggestions: string[];
  isComplete: boolean;
}

export function calculateProfileCompletion(profile?: Partial<FacultyProfileUpdateInput> | null): ProfileCompletionResult {
  if (!profile) {
    return {
      percentage: 0,
      suggestions: [
        "Add your educational background (degrees earned)",
        "Add your areas of expertise & specialty tags",
        "Write your professional biography",
        "Add your research interests and thesis topics",
        "Add your academic title and faculty designation",
      ],
      isComplete: false,
    };
  }

  let score = 0;
  const suggestions: string[] = [];

  // Academic title & designation (10%)
  if (profile.academicTitle?.trim() || profile.facultyDesignation?.trim()) {
    score += 10;
  } else {
    suggestions.push("Add your academic title and faculty designation");
  }

  // Biography (15%)
  if (profile.biography && profile.biography.trim().length >= 30) {
    score += 15;
  } else {
    suggestions.push("Write your professional biography");
  }

  // Education background (20%)
  if (Array.isArray(profile.educations) && profile.educations.length > 0) {
    score += 20;
  } else {
    suggestions.push("Add your educational background (degrees earned)");
  }

  // Areas of expertise (15%)
  if (Array.isArray(profile.expertiseKeywords) && profile.expertiseKeywords.length > 0) {
    score += 15;
  } else {
    suggestions.push("Add your areas of expertise & specialty tags");
  }

  // Research interests or specialized topics (15%)
  if (
    (Array.isArray(profile.researchInterests) && profile.researchInterests.length > 0) ||
    (Array.isArray(profile.specializedTopics) && profile.specializedTopics.length > 0)
  ) {
    score += 15;
  } else {
    suggestions.push("Add your research interests and specialized topics");
  }

  // Mentoring philosophy or teaching background (10%)
  if (profile.mentoringPhilosophy?.trim() || profile.teachingBackground?.trim()) {
    score += 10;
  } else {
    suggestions.push("Share your research mentoring philosophy or teaching background");
  }

  // Professional & Academic Experience (10%)
  if (Array.isArray(profile.experiences) && profile.experiences.length > 0) {
    score += 10;
  } else {
    suggestions.push("Add relevant teaching or industry experience");
  }

  // Certifications or Publications (5%)
  if (
    (Array.isArray(profile.certifications) && profile.certifications.length > 0) ||
    (Array.isArray(profile.publications) && profile.publications.length > 0) ||
    (Array.isArray(profile.awards) && profile.awards.length > 0)
  ) {
    score += 5;
  }

  const percentage = Math.min(100, score);
  return {
    percentage,
    suggestions,
    isComplete: percentage >= 85,
  };
}
