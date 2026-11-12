import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";

export type EvaluationScope = {
  id: string;
  prisma: PrismaClient;
  storageRoot: string;
  projectIds?: string[];
};
export const evaluationContext = new AsyncLocalStorage<EvaluationScope>();

// Adds restrictions inside evaluation only; native role/college checks still apply.
export function evaluationProjectWhere() {
  const ids = evaluationContext.getStore()?.projectIds;
  return ids ? { id: { in: ids } } : {};
}
export function evaluationModelWhere(model: string) {
  const project = evaluationProjectWhere();
  if (!("id" in project)) return null;
  if (model === "ResearchProject") return project;
  if (
    [
      "ResearchMember",
      "Document",
      "TaskSubmission",
      "TaskSubmissionAttempt",
      "ReviewerAssignment",
      "AdviserRequest",
      "Consultation",
      "WorkflowInstance",
      "DefenseSession",
      "DefenseEligibility",
      "TitleProposalSubmission",
    ].includes(model)
  )
    return { researchId: project.id };
  if (model === "DocumentVersion")
    return { document: { researchId: project.id } };
  if (model === "ConsultationRecord")
    return { consultation: { researchId: project.id } };
  return null;
}

// Resolve delegates at call time: concurrent requests must never share a tenant.
export function scopedClient<T extends object>(
  fallback: T,
  context: AsyncLocalStorage<{ prisma: T }>,
  enabled: () => boolean,
): T {
  return new Proxy(fallback, {
    get(_target, key) {
      const client = context.getStore()?.prisma;
      if (!client && enabled())
        throw new Error(
          "An evaluation workspace is required for database access.",
        );
      const owner = client || fallback;
      const value = Reflect.get(owner, key, owner);
      return typeof value === "function" ? value.bind(owner) : value;
    },
  });
}
