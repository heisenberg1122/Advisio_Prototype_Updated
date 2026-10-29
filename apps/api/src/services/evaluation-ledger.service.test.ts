import { describe, expect, it } from "vitest";
import type { EvaluationLedgerEvent } from "@prisma/client";
import { defaultStructuredForm } from "@research-management/validations";
import {
  scoreStructuredEvaluation,
  evaluationPdfHash,
  readForm,
} from "./structured-evaluation.service.js";
import {
  canonicalJson,
  GENESIS_HASH,
  ledgerEventHash,
  verifyEvaluationLedger,
  makeCheckpoint,
  submissionPayload,
  releasePayload,
  appendEvaluationEvent,
  type IntegrityState,
} from "./evaluation-ledger.service.js";

const sessionId = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
function fixture() {
  const snapshot = {
    spec: structuredClone(defaultStructuredForm),
    roster: [{ userId: "student", name: "Student" }],
    panelists: [{ userId: actor, name: "Panelist", required: true }],
    researchTitle: "Defense",
    manuscriptVersionId: "version",
    publishedAt: "2026-10-30T00:00:00.000Z",
  };
  const answers = {
    researchers: {
      student: Object.fromEntries(
        snapshot.spec.presentation.map((c) => [c.id, 5]),
      ),
    },
    manuscript: Object.fromEntries(
      snapshot.spec.manuscript.map((c) => [c.id, 5]),
    ),
    recommendation: "APPROVED",
    feedback: "",
    signature: "",
  };
  const scored = scoreStructuredEvaluation(snapshot, answers, true);
  const pdfData = Buffer.from("exact retained PDF bytes");
  const state: IntegrityState = {
    id: sessionId,
    evaluationLedgerStartedAt: new Date(snapshot.publishedAt),
    decision: null,
    releasedAt: null,
    releasedBy: null,
    packet: {
      structuredForm: snapshot,
      mappingVersion: 1,
      manuscriptVersionId: "version",
      status: "PUBLISHED",
      evaluationMode: "STRUCTURED",
    },
    structuredEvaluations: [
      {
        id: "evaluation",
        panelistId: actor,
        revision: 1,
        answers: scored.answers,
        totals: scored.totals,
        lockedAt: new Date(),
        pdfData,
        previewHash: evaluationPdfHash(pdfData),
      },
    ],
  };
  const events: EvaluationLedgerEvent[] = [];
  const add = (eventType: string, payload: unknown) => {
    const event = {
      id: String(events.length + 1),
      defenseSessionId: sessionId,
      sequence: events.length + 1,
      eventType,
      payloadVersion: 1,
      actorId: actor,
      actorRoles: ["PANELIST"],
      occurredAt: new Date(),
      operationId: `operation-${events.length + 1}`,
      payload: JSON.parse(canonicalJson(payload)),
      previousHash: events.at(-1)?.eventHash ?? GENESIS_HASH,
    };
    const saved = { ...event, eventHash: ledgerEventHash(event) };
    events.push(saved);
    return saved;
  };
  add("FORM_PUBLISHED", {
    snapshot,
    mappingVersion: 1,
    publicationReason: null,
  });
  add(
    "EVALUATION_SUBMITTED",
    submissionPayload(state.structuredEvaluations[0]),
  );
  return { state, events, add };
}

describe("evaluation ledger integrity", () => {
  it("canonicalizes key order and rejects ambiguous/non-JSON data", () => {
    expect(canonicalJson({ b: 2, a: { y: 1, x: 0 } })).toBe(
      canonicalJson({ a: { x: 0, y: 1 }, b: 2 }),
    );
    expect(() => canonicalJson({ a: undefined })).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
  it("separates internal consistency from checkpoint comparison and coverage", () => {
    const { state, events } = fixture();
    expect(verifyEvaluationLedger(state, events).status).toBe("CHAIN_VALID");
    expect(
      verifyEvaluationLedger(state, events, makeCheckpoint(events[1])),
    ).toMatchObject({ status: "CHECKPOINT_MATCH", checkpointCoversHead: true });
    expect(
      verifyEvaluationLedger(state, events, makeCheckpoint(events[0])),
    ).toMatchObject({
      status: "CHECKPOINT_MATCH",
      checkpointCoversHead: false,
    });
  });
  it.each([
    "ratings",
    "feedback",
    "totals",
    "pdf",
    "form",
    "lock",
    "missing evaluation",
    "marker",
  ])("detects altered %s", (change) => {
    const { state, events } = fixture(),
      e = state.structuredEvaluations[0];
    if (change === "ratings")
      (e.answers as any).manuscript[defaultStructuredForm.manuscript[0].id] = 4;
    if (change === "feedback") (e.answers as any).feedback = "Changed feedback";
    if (change === "totals") (e.totals as any).manuscript.score = 1;
    if (change === "pdf") e.pdfData = Buffer.from("modified");
    if (change === "form")
      (state.packet!.structuredForm as any).spec.name = "Changed form";
    if (change === "lock") e.lockedAt = null;
    if (change === "missing evaluation") state.structuredEvaluations = [];
    if (change === "marker") state.evaluationLedgerStartedAt = null;
    expect(verifyEvaluationLedger(state, events).status).toBe("MISMATCH");
  });
  it.each(["edit", "delete", "reorder", "append unsupported"])(
    "detects ledger %s",
    (change) => {
      const { state, events, add } = fixture();
      if (change === "edit") events[0].actorId = "different";
      if (change === "delete") events.pop();
      if (change === "reorder") events.reverse();
      if (change === "append unsupported") add("UNKNOWN", {});
      expect(verifyEvaluationLedger(state, events).status).toBe("MISMATCH");
    },
  );
  it("detects a coordinated rewrite against a previously retained checkpoint", () => {
    const { state, events } = fixture();
    const retained = makeCheckpoint(events[1]);
    (state.structuredEvaluations[0].answers as any).feedback =
      "Rewritten feedback";
    events[1].payload = JSON.parse(
      canonicalJson(submissionPayload(state.structuredEvaluations[0])),
    );
    events[1].eventHash = ledgerEventHash(events[1]);
    expect(verifyEvaluationLedger(state, events).status).toBe("CHAIN_VALID");
    expect(verifyEvaluationLedger(state, events, retained).status).toBe(
      "MISMATCH",
    );
    expect(
      verifyEvaluationLedger(state, events, {
        ...retained,
        defenseSessionId: actor,
      }).status,
    ).toBe("MISMATCH");
  });
  it("verifies the released decision, averages and source submissions", () => {
    const { state, events, add } = fixture();
    state.releasedAt = new Date();
    state.releasedBy = actor;
    state.decision = "APPROVED";
    add("RESULT_RELEASED", releasePayload(state, events, ""));
    expect(verifyEvaluationLedger(state, events).status).toBe("CHAIN_VALID");
    state.decision = "REJECTED";
    expect(verifyEvaluationLedger(state, events).status).toBe("MISMATCH");
  });
  it("does not invent historical coverage", () => {
    const { state } = fixture();
    state.evaluationLedgerStartedAt = null;
    expect(verifyEvaluationLedger(state, []).status).toBe("LEGACY");
  });
  it("recomputes totals even if an attacker also changes the stored snapshot and event hash", () => {
    const { state, events } = fixture();
    (state.structuredEvaluations[0].totals as any).manuscript.score = 12;
    events[1].payload = JSON.parse(
      canonicalJson(submissionPayload(state.structuredEvaluations[0])),
    );
    events[1].eventHash = ledgerEventHash(events[1]);
    expect(verifyEvaluationLedger(state, events).status).toBe("MISMATCH");
    expect(readForm(state.packet!.structuredForm).panelists).toHaveLength(1);
  });
  it("deduplicates retried operations and rejects reuse for different data", async () => {
    const { events } = fixture();
    const existing = events[0];
    const db: any = {
      $queryRaw: async () => [],
      evaluationLedgerEvent: { findUnique: async () => existing },
    };
    const input = {
      sessionId,
      eventType: "FORM_PUBLISHED" as const,
      actorId: actor,
      actorRoles: ["PANELIST"],
      operationId: existing.operationId,
      payload: existing.payload,
    };
    expect(await appendEvaluationEvent(db, input)).toBe(existing);
    await expect(
      appendEvaluationEvent(db, { ...input, payload: {} }),
    ).rejects.toThrow("different data");
  });
});
