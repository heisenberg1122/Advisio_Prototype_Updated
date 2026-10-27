import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  provisionResearchCase,
  ResearchCaseProvisioningError,
  type ResearchCaseProvisioningErrorCode,
} from "../services/research-case-provisioning.service.js";

const router = Router();
const errors = {
  INVALID_PROVISIONING_INPUT: [400, "Invalid research-start identifiers."],
  COHORT_NOT_FOUND: [404, "Research cohort not found."],
  COHORT_NOT_ACTIVE: [409, "Research can only start in an active cohort."],
  COHORT_PROCESS_NOT_ASSIGNED: [
    409,
    "The coordinator must assign a research process before the team starts.",
  ],
  COHORT_PROCESS_NOT_FOUND: [
    409,
    "The assigned research process is unavailable.",
  ],
  COHORT_PROCESS_NOT_PUBLISHED: [
    409,
    "The assigned research process must be published before the team starts.",
  ],
  WORKSPACE_NOT_FOUND: [404, "Workspace not found."],
  WORKSPACE_COHORT_MISMATCH: [
    409,
    "This workspace must be linked to the correct research cohort before starting.",
  ],
  ACTOR_NOT_COHORT_MEMBER: [
    403,
    "Active cohort membership is required to start research.",
  ],
  ACTOR_NOT_WORKSPACE_MEMBER: [
    403,
    "Active workspace membership is required to start research.",
  ],
  ACTOR_NOT_WORKSPACE_LEADER: [
    403,
    "Only the active workspace leader can start research.",
  ],
  TEAM_MEMBER_NOT_IN_COHORT: [
    409,
    "Every active team participant must belong to this research cohort.",
  ],
  TEAM_MEMBER_NOT_ELIGIBLE: [
    409,
    "Every active team participant must be an active researcher in the cohort's academic program.",
  ],
  INVALID_TEAM_LEADERSHIP: [
    409,
    "The team must have one active leader and valid participation settings.",
  ],
  WORKFLOW_ACCESS_REVOKED: [
    409,
    "This team cannot start because one or more members do not currently have access to the assigned research process. Ask the coordinator to resolve access.",
  ],
  WORKFLOW_ACCESS_MISSING: [
    409,
    "Process access for the existing research case requires coordinator review.",
  ],
  INVALID_ACADEMIC_SCOPE: [
    409,
    "The cohort, team and process must have consistent active academic settings.",
  ],
  NO_ACTIVE_WORKFLOW_STAGE: [
    409,
    "The assigned research process has no active milestones.",
  ],
  MULTIPLE_RESEARCH_CASES: [
    409,
    "This team has multiple cohort research cases and requires coordinator review.",
  ],
  EXISTING_CASE_INCONSISTENT: [
    409,
    "The existing research case requires coordinator review before it can be reused.",
  ],
} satisfies Record<
  ResearchCaseProvisioningErrorCode,
  readonly [number, string]
>;

router.post(
  "/:id/start-research",
  requireAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(z.object({}).strict().default({})),
  async (req, res) => {
    try {
      if (!req.user!.roles.includes("RESEARCHER"))
        return void res
          .status(403)
          .json({ error: "Researcher access is required." });
      if (Object.keys(req.query).length)
        return void res
          .status(400)
          .json({ error: "Research start accepts no query metadata." });
      const workspaceId = String(req.params.id);
      const workspace = await prisma.researchWorkspace.findUnique({
        where: { id: workspaceId },
        select: {
          cohortId: true,
          members: {
            where: { userId: req.user!.id, leftAt: null },
            select: { role: true },
          },
        },
      });
      if (!workspace)
        return void res.status(404).json({ error: "Workspace not found." });
      if (!workspace.members.some((member) => member.role === "LEADER"))
        return void res.status(403).json({
          error: "Only the active workspace leader can start research.",
        });
      if (!workspace.cohortId)
        return void res.status(409).json({
          error:
            "This workspace must be linked to a research cohort before starting.",
        });
      const result = await provisionResearchCase({
        cohortId: workspace.cohortId,
        workspaceId,
        actorId: req.user!.id,
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      if (error instanceof ResearchCaseProvisioningError) {
        const [status, message] = errors[error.code];
        return void res.status(status).json({ error: message });
      }
      const code = (error as { code?: string } | null)?.code;
      if (["P2034", "P2002", "P2003", "P2025"].includes(code || ""))
        return void res.status(409).json({
          error:
            "The workspace or process changed. Reload and retry starting research.",
        });
      res.status(500).json({ error: "Unable to start research." });
    }
  },
);

export default router;
