export type DefenseBadge = {
  id: string;
  kind: string;
  issuedAt: string;
  issuer: { firstName: string; lastName: string };
  recipients: Array<{ userId: string; name: string }>;
};

export function DefenseBadgeCard({ badge }: { badge: DefenseBadge }) {
  return (
    <article className="flex gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <span
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-800"
        aria-hidden="true"
      >
        <i className="ti ti-award" />
      </span>
      <div className="min-w-0 text-[var(--color-text-primary)]">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Group achievement
        </p>
        <h3 className="mt-1 text-lg font-bold">
          {badge.kind === "TITLE_DEFENSE" ? "Title" : "Final"} Defense Passed
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Issued by {badge.issuer.firstName} {badge.issuer.lastName} ·{" "}
          {new Date(badge.issuedAt).toLocaleDateString()}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Awarded to{" "}
          {badge.recipients.map((recipient) => recipient.name).join(", ")}
        </p>
        <p className="mt-2 break-all text-xs text-[var(--color-text-muted)]">
          Badge ID: {badge.id}
        </p>
      </div>
    </article>
  );
}
