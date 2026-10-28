import { Router, type Request, type Response } from "express";
import {
  ReviewRecommendation,
  ReviewerAssignmentStatus,
  ReviewType,
} from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  ReviewerAssignmentError,
  reviewerAssignmentService,
} from "../services/reviewer-assignment.service.js";

const router = Router();

function workflowError(res: Response, error: unknown) {
  if (error instanceof ReviewerAssignmentError) {
    res
      .status(error.statusCode)
      .json({ error: error.message, code: error.code });
    return;
  }
  const code = (error as any)?.code;
  if (code === "P2002") {
    res.status(409).json({
      error: "That reviewer assignment or decision already exists.",
      code: "DUPLICATE_REVIEW_OPERATION",
    });
    return;
  }
  console.error("[ManuscriptReview] Unexpected workflow failure", {
    method: res.req.method,
    path: res.req.path,
    error,
  });
  res.status(500).json({ error: "Unable to process the manuscript review." });
}

router.get(
  "/reviewer-assignments/me",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const requested =
        typeof req.query.status === "string"
          ? req.query.status.toUpperCase()
          : undefined;
      if (
        requested &&
        !Object.values(ReviewerAssignmentStatus).includes(
          requested as ReviewerAssignmentStatus,
        )
      )
        return void res
          .status(400)
          .json({ error: "Invalid assignment status." });
      const assignments = await reviewerAssignmentService.listMine(
        req.user!,
        requested,
      );
      res.json({ assignments });
    } catch (error) {
      workflowError(res, error);
    }
  },
);

router.get(
  "/documents/:documentId/review-workflow",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const document = await reviewerAssignmentService.reviewWorkflow(
        req.user!,
        req.params.documentId as string,
      );
      res.json({ document });
    } catch (error) {
      workflowError(res, error);
    }
  },
);

router.get(
  "/documents/versions/:versionId/reviewer-candidates",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const candidates = await reviewerAssignmentService.candidates(
        req.user!,
        req.params.versionId as string,
      );
      res.json({ candidates });
    } catch (error) {
      workflowError(res, error);
    }
  },
);

router.post(
  "/documents/versions/:versionId/reviewer-assignments",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const reviewerId =
        typeof req.body?.reviewerId === "string" ? req.body.reviewerId : "";
      const reviewType = req.body?.reviewType as ReviewType;
      if (!reviewerId || !Object.values(ReviewType).includes(reviewType))
        return void res.status(400).json({
          error: "A valid reviewer and review type are required.",
        });
      const assignment = await reviewerAssignmentService.assign({
        versionId: req.params.versionId as string,
        reviewerId,
        reviewType,
        isRequired: req.body?.isRequired !== false,
        user: req.user!,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.status(201).json({ assignment });
    } catch (error) {
      workflowError(res, error);
    }
  },
);

router.patch(
  "/reviewer-assignments/:assignmentId/revoke",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      const assignment = await reviewerAssignmentService.revoke({
        assignmentId: req.params.assignmentId as string,
        reason,
        user: req.user!,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.json({ assignment });
    } catch (error) {
      workflowError(res, error);
    }
  },
);

router.post(
  "/reviewer-assignments/:assignmentId/reassign",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const reviewerId =
        typeof req.body?.reviewerId === "string" ? req.body.reviewerId : "";
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!reviewerId)
        return void res
          .status(400)
          .json({ error: "Select a replacement reviewer." });
      const assignment = await reviewerAssignmentService.reassign({
        assignmentId: req.params.assignmentId as string,
        reviewerId,
        reason,
        user: req.user!,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.status(201).json({ assignment });
    } catch (error) {
      workflowError(res, error);
    }
  },
);

router.post(
  "/reviewer-assignments/:assignmentId/decision",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const recommendation = req.body?.recommendation as ReviewRecommendation;
      if (!Object.values(ReviewRecommendation).includes(recommendation))
        return void res
          .status(400)
          .json({ error: "Select a valid recommendation." });
      const comments = Array.isArray(req.body?.comments)
        ? req.body.comments.slice(0, 100)
        : [];
      const result = await reviewerAssignmentService.decide({
        assignmentId: req.params.assignmentId as string,
        recommendation,
        overallComment:
          typeof req.body?.overallComment === "string"
            ? req.body.overallComment
            : null,
        comments,
        user: req.user!,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.status(201).json(result);
    } catch (error) {
      workflowError(res, error);
    }
  },
);

export default router;
