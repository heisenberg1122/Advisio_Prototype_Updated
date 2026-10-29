import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  EvaluationIntegrity,
  type IntegrityReport,
} from "./EvaluationIntegrity";

const report: IntegrityReport = {
  status: "CHAIN_VALID",
  checkedAt: "2026-10-30T00:00:00Z",
  eventCount: 2,
  issues: [],
  checkpointSequence: null,
  checkpointCoversHead: false,
  head: {
    format: "advisio-evaluation-checkpoint-v1",
    defenseSessionId: "session",
    sequence: 2,
    eventHash: "a".repeat(64),
  },
  history: [
    {
      sequence: 1,
      eventType: "FORM_PUBLISHED",
      occurredAt: "2026-10-30T00:00:00Z",
      eventHash: "b".repeat(64),
    },
  ],
};
const props = { busy: false, onVerify: vi.fn(), onCheckpoint: vi.fn() };
describe("evaluation integrity disclosure", () => {
  it("does not present internal consistency as independently verified history", () => {
    const html = renderToStaticMarkup(
      <EvaluationIntegrity {...props} report={report} />,
    );
    expect(html).toContain("No retained checkpoint compared");
    expect(html).toContain("cannot verify who retained it");
  });
  it("shows a checkpoint's limited coverage", () => {
    const html = renderToStaticMarkup(
      <EvaluationIntegrity
        {...props}
        report={{
          ...report,
          status: "CHECKPOINT_MATCH",
          checkpointSequence: 1,
        }}
      />,
    );
    expect(html).toContain("Later records are outside this checkpoint");
  });
  it("keeps the student view free of facilitator history and retention controls", () => {
    const html = renderToStaticMarkup(
      <EvaluationIntegrity {...props} report={report} student />,
    );
    expect(html).not.toContain("Download checkpoint");
    expect(html).not.toContain("form published");
    expect(html).not.toContain("b".repeat(64));
  });
  it("distinguishes unavailable verification and legacy coverage from success", () => {
    const unavailable = renderToStaticMarkup(
      <EvaluationIntegrity {...props} error="Service unavailable" />,
    );
    expect(unavailable).toContain("Verification unavailable");
    expect(unavailable).not.toContain("Internal chain valid");
    const legacy = renderToStaticMarkup(
      <EvaluationIntegrity
        {...props}
        report={{ ...report, status: "LEGACY", head: null, history: [] }}
      />,
    );
    expect(legacy).toContain("Outside ledger coverage");
    expect(legacy).not.toContain("Download checkpoint");
  });
});
