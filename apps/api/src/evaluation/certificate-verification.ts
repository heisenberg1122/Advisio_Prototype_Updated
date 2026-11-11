type Verification = {
  recipientName: string;
  collegeName: string;
  awardedAt: Date;
};

const lifetimeMs = 60 * 60 * 1000;
const maxEntries = 4096;
const published = new Map<string, { details: Verification; expiresAt: number }>();

// Evaluation certificates belong to disposable workspaces. Publish only the
// three public fields, with no workspace ID or credential, when the recipient
// opens their certificate. The scan handler never opens a workspace database.
export function publishEvaluationCertificate(certificate: Verification & { id: string }) {
  const { id, recipientName, collegeName, awardedAt } = certificate;
  const now = Date.now();
  for (const [code, entry] of published) {
    if (entry.expiresAt > now) break;
    published.delete(code);
  }
  published.delete(id);
  if (published.size >= maxEntries) {
    const oldest = published.keys().next().value;
    if (oldest) published.delete(oldest);
  }
  published.set(id, {
    details: { recipientName, collegeName, awardedAt },
    expiresAt: now + lifetimeMs,
  });
}

export function verifyEvaluationCertificate(code: string) {
  const entry = published.get(code);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.details;
}
