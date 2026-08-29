import { z } from "zod";
export const uploadDocumentSchema = z.object({
    researchId: z.string().uuid("Invalid research ID"),
    title: z.string().min(2).max(200),
    documentType: z.string().min(1).max(50),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    fileSize: z.number().int().positive(),
    storagePath: z.string().min(1),
    googleDriveFileId: z.string().optional(),
});
export const reviewSchema = z.object({
    documentVersionId: z.string().uuid("Invalid document version ID"),
    reviewType: z.string().min(1).max(50),
    overallComment: z.string().optional(),
    recommendation: z.string().optional(),
});
export const reviewCommentSchema = z.object({
    reviewId: z.string().uuid("Invalid review ID"),
    documentVersionId: z.string().uuid("Invalid document version ID"),
    comment: z.string().min(1, "Comment text is required"),
    locationData: z.record(z.any()).optional(),
});
//# sourceMappingURL=documents.js.map