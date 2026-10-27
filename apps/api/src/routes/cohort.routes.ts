import { Router, type RequestHandler } from "express";
import { Permissions } from "@research-management/auth";
import {
  addCohortMembersSchema,
  assignCohortWorkflowSchema,
  cohortListQuerySchema,
  cohortMemberParamsSchema,
  cohortParamsSchema,
  createCohortSchema,
  updateCohortSchema,
  type CohortListQuery,
  eligibleCohortResearchersQuerySchema,
  type EligibleCohortResearchersQuery,
} from "@research-management/validations";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import {
  addCohortMembers,
  assignCohortWorkflow,
  CohortError,
  createCohort,
  getCohort,
  listCohortMembers,
  listEligibleCohortResearchers,
  listCohorts,
  removeCohortMember,
  updateCohort,
} from "../services/cohort.service.js";

const router = Router();
router.use(requireAuth);

function route(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof CohortError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      const code = (error as { code?: string } | null)?.code;
      if (["P2002", "P2003", "P2034"].includes(code || "")) {
        res.status(409).json({
          error:
            "The cohort changed or a referenced record is unavailable. Reload and retry.",
        });
        return;
      }
      if (code === "P2025") {
        res.status(404).json({ error: "Cohort record not found." });
        return;
      }
      console.error("Cohort operation failed", error);
      res
        .status(500)
        .json({ error: "Unable to complete the cohort operation." });
    }
  };
}

router.get(
  "/",
  requirePermission(Permissions.RESEARCH_VIEW),
  validateQuery(cohortListQuerySchema),
  route(async (req, res) => {
    res.json(
      await listCohorts(req.user!, req.query as unknown as CohortListQuery),
    );
  }),
);
router.post(
  "/",
  requirePermission(Permissions.WORKFLOW_CREATE),
  validateBody(createCohortSchema),
  route(async (req, res) => {
    res.status(201).json({ cohort: await createCohort(req.user!, req.body) });
  }),
);
router.get(
  "/:id",
  requirePermission(Permissions.RESEARCH_VIEW),
  validateParams(cohortParamsSchema),
  route(async (req, res) => {
    res.json({ cohort: await getCohort(req.user!, String(req.params.id)) });
  }),
);
router.patch(
  "/:id",
  requirePermission(Permissions.WORKFLOW_EDIT),
  validateParams(cohortParamsSchema),
  validateBody(updateCohortSchema),
  route(async (req, res) => {
    res.json({
      cohort: await updateCohort(req.user!, String(req.params.id), req.body),
    });
  }),
);
router.get(
  "/:id/eligible-researchers",
  requirePermission(Permissions.RESEARCH_ASSIGN),
  validateParams(cohortParamsSchema),
  validateQuery(eligibleCohortResearchersQuerySchema),
  route(async (req, res) => {
    res.json(
      await listEligibleCohortResearchers(
        req.user!,
        String(req.params.id),
        req.query as unknown as EligibleCohortResearchersQuery,
      ),
    );
  }),
);
router.get(
  "/:id/members",
  requirePermission(Permissions.RESEARCH_VIEW),
  validateParams(cohortParamsSchema),
  route(async (req, res) => {
    res.json({
      members: await listCohortMembers(req.user!, String(req.params.id)),
    });
  }),
);
router.post(
  "/:id/members",
  requirePermission(Permissions.RESEARCH_ASSIGN),
  validateParams(cohortParamsSchema),
  validateBody(addCohortMembersSchema),
  route(async (req, res) => {
    res.status(201).json({
      members: await addCohortMembers(
        req.user!,
        String(req.params.id),
        req.body.userIds,
      ),
    });
  }),
);
router.delete(
  "/:id/members/:userId",
  requirePermission(Permissions.RESEARCH_ASSIGN),
  validateParams(cohortMemberParamsSchema),
  route(async (req, res) => {
    res.json({
      member: await removeCohortMember(
        req.user!,
        String(req.params.id),
        String(req.params.userId),
      ),
    });
  }),
);
router.put(
  "/:id/workflow",
  requirePermission(Permissions.WORKFLOW_EDIT),
  validateParams(cohortParamsSchema),
  validateBody(assignCohortWorkflowSchema),
  route(async (req, res) => {
    res.json({
      cohort: await assignCohortWorkflow(
        req.user!,
        String(req.params.id),
        req.body.workflowId,
      ),
    });
  }),
);

export default router;
