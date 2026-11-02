import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import {
  commentVersionSchema,
  submissionCommentSchema,
  listSubmissionComments,
  postSubmissionComment,
  SubmissionCommentError,
} from "../services/submission-comment.service.js";

const router = Router();
const params = z.object({ submissionId: z.string().uuid() });
const query = z.object({
  documentVersionId: commentVersionSchema,
  cursor: z.string().uuid().optional(),
});
router.get(
  "/tasks/submissions/:submissionId/comments",
  requireAuth,
  async (req, res) => {
    try {
      const { submissionId } = params.parse(req.params);
      const { documentVersionId, cursor } = query.parse(req.query);
      res.json(
        await listSubmissionComments(
          submissionId,
          documentVersionId,
          req.user!,
          cursor,
        ),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);
router.post(
  "/tasks/submissions/:submissionId/comments",
  requireAuth,
  async (req, res) => {
    try {
      const { submissionId } = params.parse(req.params);
      const body = submissionCommentSchema.parse(req.body);
      res
        .status(201)
        .json({
          comment: await postSubmissionComment(submissionId, body, req.user!),
        });
    } catch (error) {
      handleError(error, res);
    }
  },
);
function handleError(error: unknown, res: import("express").Response) {
  if (error instanceof z.ZodError)
    return void res
      .status(400)
      .json({
        error:
          "Enter a comment of 1–2,000 characters and a valid submitted version and page.",
      });
  if (error instanceof SubmissionCommentError)
    return void res.status(error.statusCode).json({ error: error.message });
  console.error("Submission comments failed", error);
  res
    .status(500)
    .json({ error: "Unable to load or save submission comments." });
}
export default router;
