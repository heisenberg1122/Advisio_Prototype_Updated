import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { SubmissionCommentError } from "../services/submission-comment.service.js";
import {
  getSubmissionGrade,
  saveSubmissionGrade,
  setRequirementPoints,
  submissionHistory,
  gradeActionSchema,
  maxPointsSchema,
  SubmissionGradingError,
} from "../services/submission-grading.service.js";
const router = Router();
const id = z.string().uuid();
const query = z.object({ documentVersionId: id });
const errorResponse = (error: unknown, res: Response) => {
  if (error instanceof z.ZodError)
    return void res
      .status(400)
      .json({
        error:
          "Enter valid points, score, submitted version, and grade revision.",
      });
  if (
    error instanceof SubmissionGradingError ||
    error instanceof SubmissionCommentError
  )
    return void res.status(error.statusCode).json({ error: error.message });
  console.error("Submission grading failed", error);
  res
    .status(500)
    .json({ error: "Unable to load or save the grade or history." });
};
router.get(
  "/tasks/submissions/:submissionId/grade",
  requireAuth,
  async (req, res) => {
    try {
      const { documentVersionId } = query.parse(req.query);
      res.json(
        await getSubmissionGrade(
          id.parse(req.params.submissionId),
          documentVersionId,
          req.user!,
        ),
      );
    } catch (error) {
      errorResponse(error, res);
    }
  },
);
router.patch(
  "/tasks/submissions/:submissionId/grade",
  requireAuth,
  async (req, res) => {
    try {
      res.json({
        grade: await saveSubmissionGrade(
          id.parse(req.params.submissionId),
          gradeActionSchema.parse(req.body),
          req.user!,
        ),
      });
    } catch (error) {
      errorResponse(error, res);
    }
  },
);
router.get(
  "/tasks/submissions/:submissionId/history",
  requireAuth,
  async (req, res) => {
    try {
      const { documentVersionId } = query.parse(req.query);
      res.json(
        await submissionHistory(
          id.parse(req.params.submissionId),
          documentVersionId,
          req.user!,
        ),
      );
    } catch (error) {
      errorResponse(error, res);
    }
  },
);
router.patch("/tasks/:taskId/grading", requireAuth, async (req, res) => {
  try {
    res.json(
      await setRequirementPoints(
        id.parse(req.params.taskId),
        maxPointsSchema.parse(req.body?.maxPoints),
        req.user!,
      ),
    );
  } catch (error) {
    errorResponse(error, res);
  }
});
export default router;
