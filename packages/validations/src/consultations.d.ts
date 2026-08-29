import { z } from "zod";
export declare const createConsultationSchema: z.ZodObject<{
    researchId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    scheduledStart: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    scheduledEnd: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    meetingUrl: z.ZodOptional<z.ZodString>;
    participantIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    researchId: string;
    scheduledStart: string | Date;
    scheduledEnd: string | Date;
    description?: string | undefined;
    meetingUrl?: string | undefined;
    participantIds?: string[] | undefined;
}, {
    title: string;
    researchId: string;
    scheduledStart: string | Date;
    scheduledEnd: string | Date;
    description?: string | undefined;
    meetingUrl?: string | undefined;
    participantIds?: string[] | undefined;
}>;
export declare const consultationParticipantSchema: z.ZodObject<{
    consultationId: z.ZodString;
    userId: z.ZodString;
    attendanceStatus: z.ZodDefault<z.ZodEnum<["INVITED", "ACCEPTED", "DECLINED", "JOINED", "LEFT", "NO_SHOW"]>>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    consultationId: string;
    attendanceStatus: "INVITED" | "ACCEPTED" | "DECLINED" | "JOINED" | "LEFT" | "NO_SHOW";
}, {
    userId: string;
    consultationId: string;
    attendanceStatus?: "INVITED" | "ACCEPTED" | "DECLINED" | "JOINED" | "LEFT" | "NO_SHOW" | undefined;
}>;
export declare const consultationNoteSchema: z.ZodObject<{
    consultationId: z.ZodString;
    notes: z.ZodString;
}, "strip", z.ZodTypeAny, {
    consultationId: string;
    notes: string;
}, {
    consultationId: string;
    notes: string;
}>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type ConsultationParticipantInput = z.infer<typeof consultationParticipantSchema>;
export type ConsultationNoteInput = z.infer<typeof consultationNoteSchema>;
//# sourceMappingURL=consultations.d.ts.map