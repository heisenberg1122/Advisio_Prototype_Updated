import { createHash } from "node:crypto";
import type { Prisma, EvaluationLedgerEvent } from "@prisma/client";
import { z } from "zod";
import {
  readForm,
  scoreStructuredEvaluation,
  consolidatedScores,
  evaluationPdfHash,
} from "./structured-evaluation.service.js";

export const GENESIS_HASH = "0".repeat(64);
export class EvaluationIntegrityError extends Error {
  statusCode = 409;
}

// Version 1: JSON primitives; sorted object keys; array order is significant.
// Scores use the existing server scoring rules and JSON number representation.
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return `{${Object.keys(value as object)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  throw new Error("Ledger payload must contain only finite JSON values.");
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalJson(value));

export function ledgerEventHash(
  event: Omit<
    EvaluationLedgerEvent,
    "id" | "eventHash" | "actorRoles" | "payload"
  > & { actorRoles: unknown; payload: unknown },
): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        domain: "advisio:evaluation-ledger:v1",
        defenseSessionId: event.defenseSessionId,
        sequence: event.sequence,
        eventType: event.eventType,
        payloadVersion: event.payloadVersion,
        actorId: event.actorId,
        actorRoles: event.actorRoles,
        occurredAt: event.occurredAt.toISOString(),
        operationId: event.operationId,
        payload: event.payload,
        previousHash: event.previousHash,
      }),
    )
    .digest("hex");
}

export const checkpointSchema = z
  .object({
    format: z.literal("advisio-evaluation-checkpoint-v1"),
    defenseSessionId: z.string().uuid(),
    sequence: z.number().int().positive(),
    eventHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export type EvaluationCheckpoint = z.infer<typeof checkpointSchema>;
export function makeCheckpoint(
  event: EvaluationLedgerEvent,
): EvaluationCheckpoint {
  return {
    format: "advisio-evaluation-checkpoint-v1",
    defenseSessionId: event.defenseSessionId,
    sequence: event.sequence,
    eventHash: event.eventHash,
  };
}

export type IntegrityState = {
  id: string;
  evaluationLedgerStartedAt: Date | null;
  decision: string | null;
  releasedAt: Date | null;
  releasedBy: string | null;
  packet: {
    structuredForm: unknown;
    mappingVersion: number;
    manuscriptVersionId: string | null;
    status: string;
    evaluationMode: string;
  } | null;
  structuredEvaluations: {
    id: string;
    panelistId: string;
    revision: number;
    answers: unknown;
    totals: unknown;
    lockedAt: Date | null;
    previewHash: string | null;
    pdfData: Uint8Array | null;
  }[];
};

export function submissionPayload(
  e: IntegrityState["structuredEvaluations"][number],
) {
  return {
    evaluationId: e.id,
    panelistId: e.panelistId,
    revision: e.revision,
    answers: e.answers,
    totals: e.totals,
    pdfHash: e.previewHash,
    lockedAt: e.lockedAt?.toISOString() ?? null,
  };
}

export function releasePayload(
  state: IntegrityState,
  events: EvaluationLedgerEvent[],
  instructions: string,
) {
  return {
    decision: state.decision,
    releasedAt: state.releasedAt?.toISOString() ?? null,
    releasedBy: state.releasedBy,
    revisionInstructions: instructions,
    report: consolidatedScores(
      readForm(state.packet!.structuredForm),
      state.structuredEvaluations,
    ),
    submissionHashes: events
      .filter((e) => e.eventType === "EVALUATION_SUBMITTED")
      .map((e) => e.eventHash),
  };
}

export function verifyEvaluationLedger(
  state: IntegrityState,
  events: EvaluationLedgerEvent[],
  checkpoint?: EvaluationCheckpoint,
) {
  const issues: string[] = [];
  const checkedAt = new Date().toISOString();
  const legacy = !state.evaluationLedgerStartedAt && events.length === 0;
  if (!legacy) {
    if (!state.evaluationLedgerStartedAt)
      issues.push("Ledger enrollment marker is missing.");
    if (!events.length || events[0]?.eventType !== "FORM_PUBLISHED")
      issues.push("Published form event is missing.");
    let previous = GENESIS_HASH;
    const operations = new Set<string>();
    for (const [index, event] of events.entries()) {
      if (
        event.defenseSessionId !== state.id ||
        event.sequence !== index + 1 ||
        event.previousHash !== previous
      )
        issues.push(`Broken chain at record ${index + 1}.`);
      if (
        event.payloadVersion !== 1 ||
        !["FORM_PUBLISHED", "EVALUATION_SUBMITTED", "RESULT_RELEASED"].includes(
          event.eventType,
        )
      )
        issues.push(`Unsupported record format at ${event.sequence}.`);
      if (operations.has(event.operationId))
        issues.push("Duplicate operation.");
      operations.add(event.operationId);
      if (ledgerEventHash(event) !== event.eventHash)
        issues.push(`Hash mismatch at record ${event.sequence}.`);
      previous = event.eventHash;
    }
    try {
      const formEvents = events.filter((e) => e.eventType === "FORM_PUBLISHED");
      const published = formEvents.at(-1)?.payload as any;
      if (
        !state.packet ||
        state.packet.status !== "PUBLISHED" ||
        state.packet.evaluationMode !== "STRUCTURED" ||
        !same(published?.snapshot ?? null, state.packet.structuredForm) ||
        published?.mappingVersion !== state.packet.mappingVersion ||
        published?.snapshot?.manuscriptVersionId !==
          state.packet.manuscriptVersionId
      )
        issues.push(
          "Published evaluation form differs from its ledger record.",
        );
      const firstSubmission = events.findIndex(
        (e) => e.eventType === "EVALUATION_SUBMITTED",
      );
      if (
        firstSubmission >= 0 &&
        events
          .slice(firstSubmission)
          .some((e) => e.eventType === "FORM_PUBLISHED")
      )
        issues.push("Form changed after evaluation submission.");
      const snapshot = readForm(state.packet?.structuredForm);
      const submissions = events.filter(
        (e) => e.eventType === "EVALUATION_SUBMITTED",
      );
      const locked = state.structuredEvaluations.filter((e) => e.lockedAt);
      if (submissions.length !== locked.length)
        issues.push("Final submission count differs from ledger.");
      for (const e of locked) {
        const matching = submissions.filter(
          (event) => (event.payload as any).evaluationId === e.id,
        );
        if (
          matching.length !== 1 ||
          !same(matching[0]?.payload ?? null, submissionPayload(e))
        )
          issues.push(`Final evaluation record differs: ${e.panelistId}.`);
        const scored = scoreStructuredEvaluation(snapshot, e.answers, true);
        if (!same(scored.totals, e.totals))
          issues.push(`Score calculation differs: ${e.panelistId}.`);
        if (!snapshot.panelists.some((p) => p.userId === e.panelistId))
          issues.push("Evaluator is outside the published roster.");
        if (matching[0]?.actorId !== e.panelistId)
          issues.push("Submission actor differs from evaluator.");
        if (!e.pdfData || evaluationPdfHash(e.pdfData) !== e.previewHash)
          issues.push(`Evaluation PDF differs: ${e.panelistId}.`);
      }
      const releases = events.filter((e) => e.eventType === "RESULT_RELEASED");
      if (state.releasedAt) {
        const release = releases[0],
          payload = release?.payload as any;
        if (
          releases.length !== 1 ||
          !same(
            payload ?? null,
            releasePayload(state, events, payload?.revisionInstructions ?? ""),
          ) ||
          events.at(-1)?.eventType !== "RESULT_RELEASED" ||
          release?.actorId !== state.releasedBy ||
          !consolidatedScores(snapshot, locked).final
        )
          issues.push(
            "Released result differs from the finalized evaluations or release record.",
          );
      } else if (releases.length)
        issues.push("Released result is missing from the session.");
    } catch {
      issues.push(
        "Evaluation data cannot be verified using the recorded scoring format.",
      );
    }
  }
  if (checkpoint) {
    const recorded = events.find((e) => e.sequence === checkpoint.sequence);
    if (
      checkpoint.defenseSessionId !== state.id ||
      !recorded ||
      recorded.eventHash !== checkpoint.eventHash
    )
      issues.push("Supplied checkpoint does not match retained history.");
  }
  return {
    status: issues.length
      ? "MISMATCH"
      : legacy
        ? "LEGACY"
        : checkpoint
          ? "CHECKPOINT_MATCH"
          : "CHAIN_VALID",
    checkedAt,
    issues,
    eventCount: events.length,
    checkpointSequence: checkpoint?.sequence ?? null,
    checkpointCoversHead: Boolean(
      checkpoint &&
      checkpoint.sequence === events.at(-1)?.sequence &&
      !issues.length,
    ),
    head: events.length ? makeCheckpoint(events.at(-1)!) : null,
  };
}

export async function loadEvaluationIntegrity(
  tx: Prisma.TransactionClient,
  sessionId: string,
  checkpoint?: EvaluationCheckpoint,
) {
  const state = await tx.defenseSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { packet: true, structuredEvaluations: true },
  });
  const events = await tx.evaluationLedgerEvent.findMany({
    where: { defenseSessionId: sessionId },
    orderBy: { sequence: "asc" },
  });
  return {
    state,
    events,
    verification: verifyEvaluationLedger(state, events, checkpoint),
  };
}

export function assertEvaluationIntegrity(
  verification: ReturnType<typeof verifyEvaluationLedger>,
) {
  if (verification.status === "MISMATCH")
    throw new EvaluationIntegrityError(
      "Evaluation integrity mismatch. Review the integrity report before continuing.",
    );
}

// Caller owns the business transaction. All appenders lock the same session row.
export async function appendEvaluationEvent(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    eventType: "FORM_PUBLISHED" | "EVALUATION_SUBMITTED" | "RESULT_RELEASED";
    actorId: string;
    actorRoles: string[];
    operationId: string;
    payload: unknown;
  },
) {
  await tx.$queryRaw`SELECT id FROM defense_sessions WHERE id = ${input.sessionId}::uuid FOR UPDATE`;
  const existing = await tx.evaluationLedgerEvent.findUnique({
    where: { operationId: input.operationId },
  });
  if (existing) {
    if (
      existing.defenseSessionId !== input.sessionId ||
      existing.eventType !== input.eventType ||
      existing.actorId !== input.actorId ||
      !same(existing.payload, input.payload)
    )
      throw new EvaluationIntegrityError(
        "Ledger operation was already used for different data.",
      );
    return existing;
  }
  const previous = await tx.evaluationLedgerEvent.findFirst({
    where: { defenseSessionId: input.sessionId },
    orderBy: { sequence: "desc" },
  });
  const data = {
    defenseSessionId: input.sessionId,
    sequence: (previous?.sequence ?? 0) + 1,
    eventType: input.eventType,
    payloadVersion: 1,
    actorId: input.actorId,
    actorRoles: json([...input.actorRoles].sort()),
    occurredAt: new Date(),
    operationId: input.operationId,
    payload: json(input.payload),
    previousHash: previous?.eventHash ?? GENESIS_HASH,
  };
  return tx.evaluationLedgerEvent.create({
    data: { ...data, eventHash: ledgerEventHash(data) },
  });
}
