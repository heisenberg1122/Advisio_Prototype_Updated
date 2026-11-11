import { afterEach, expect, it, vi } from "vitest";
import { publishEvaluationCertificate, verifyEvaluationCertificate } from "./certificate-verification.js";

afterEach(() => vi.useRealTimers());

it("serves only the published verification fields and expires them after one hour", () => {
  vi.useFakeTimers();
  const certificate = {
    id: "a19e0ca2-5367-4548-9afd-bc012310d663",
    recipientName: "Demo Recipient",
    collegeName: "College of Information Technology",
    awardedAt: new Date(),
    recipientId: "private",
    researchTitle: "private",
  };
  expect(verifyEvaluationCertificate(certificate.id)).toBeNull();
  publishEvaluationCertificate(certificate);
  expect(verifyEvaluationCertificate(certificate.id)).toEqual({
    recipientName: certificate.recipientName,
    collegeName: certificate.collegeName,
    awardedAt: certificate.awardedAt,
  });
  vi.advanceTimersByTime(60 * 60 * 1000);
  expect(verifyEvaluationCertificate(certificate.id)).toBeNull();
});
