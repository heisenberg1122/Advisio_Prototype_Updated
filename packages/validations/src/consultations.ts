import { z } from "zod";

export const createConsultationSchema = z.object({
  researchId: z.string().uuid("Invalid research ID"),
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  scheduledStart: z.string().or(z.date()),
  scheduledEnd: z.string().or(z.date()),
  meetingUrl: z.string().url().optional(),
  participantIds: z.array(z.string().uuid()).optional(),
});

export const consultationParticipantSchema = z.object({
  consultationId: z.string().uuid("Invalid consultation ID"),
  userId: z.string().uuid("Invalid user ID"),
  attendanceStatus: z.enum([
    "INVITED",
    "ACCEPTED",
    "DECLINED",
    "JOINED",
    "LEFT",
    "NO_SHOW",
  ]).default("INVITED"),
});

export const consultationNoteSchema = z.object({
  consultationId: z.string().uuid("Invalid consultation ID"),
  notes: z.string().min(1, "Notes cannot be empty"),
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type ConsultationParticipantInput = z.infer<typeof consultationParticipantSchema>;
export type ConsultationNoteInput = z.infer<typeof consultationNoteSchema>;
