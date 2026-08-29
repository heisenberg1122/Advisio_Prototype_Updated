import { z } from "zod";
export declare const uploadDocumentSchema: z.ZodObject<{
    researchId: z.ZodString;
    title: z.ZodString;
    documentType: z.ZodString;
    fileName: z.ZodString;
    mimeType: z.ZodString;
    fileSize: z.ZodNumber;
    storagePath: z.ZodString;
    googleDriveFileId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    researchId: string;
    documentType: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
    googleDriveFileId?: string | undefined;
}, {
    title: string;
    researchId: string;
    documentType: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storagePath: string;
    googleDriveFileId?: string | undefined;
}>;
export declare const reviewSchema: z.ZodObject<{
    documentVersionId: z.ZodString;
    reviewType: z.ZodString;
    overallComment: z.ZodOptional<z.ZodString>;
    recommendation: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    documentVersionId: string;
    reviewType: string;
    overallComment?: string | undefined;
    recommendation?: string | undefined;
}, {
    documentVersionId: string;
    reviewType: string;
    overallComment?: string | undefined;
    recommendation?: string | undefined;
}>;
export declare const reviewCommentSchema: z.ZodObject<{
    reviewId: z.ZodString;
    documentVersionId: z.ZodString;
    comment: z.ZodString;
    locationData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    documentVersionId: string;
    reviewId: string;
    comment: string;
    locationData?: Record<string, any> | undefined;
}, {
    documentVersionId: string;
    reviewId: string;
    comment: string;
    locationData?: Record<string, any> | undefined;
}>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ReviewCommentInput = z.infer<typeof reviewCommentSchema>;
//# sourceMappingURL=documents.d.ts.map