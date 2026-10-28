import {
  defenseResults,
  defenseResultLabels,
  sectionMaximum,
  sectionScore,
  type StructuredForm,
  type StructuredAnswers,
  type EvaluationRoster,
} from "@research-management/validations";

export const evaluationCard =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-primary)]";
export const evaluationInput =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm text-[var(--color-text-primary)]";
export const evaluationButton =
  "rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50";
export const emptyStructuredAnswers = (): StructuredAnswers => ({
  researchers: {},
  manuscript: {},
  recommendation: "",
  feedback: "",
  signature: "",
});
export function StructuredEvaluationFields({
  form,
  roster,
  answers,
  onChange,
  disabled = false,
}: {
  form: StructuredForm;
  roster: EvaluationRoster;
  answers: StructuredAnswers;
  onChange: (answers: StructuredAnswers) => void;
  disabled?: boolean;
}) {
  const section = (
    criteria: StructuredForm["presentation"],
    ratings: Record<string, number>,
    change: (value: Record<string, number>) => void,
    key: string,
  ) => (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 py-3 text-xs text-[var(--color-text-secondary)]">
        {form.scale.map((s) => (
          <span key={s.value}>
            {s.value} · {s.label}
          </span>
        ))}
      </div>
      {criteria.map((c) => (
        <fieldset
          key={c.id}
          disabled={disabled}
          className="border-t border-[var(--color-border)] py-4"
        >
          <legend className="float-left mb-2 w-full text-sm font-semibold">
            {c.title}
            <span className="ml-3 text-xs font-normal text-[var(--color-text-secondary)]">
              Weight {c.weight}
            </span>
          </legend>
          {c.description && (
            <p className="clear-both text-xs text-[var(--color-text-secondary)]">
              {c.description}
            </p>
          )}
          <div className="clear-both flex flex-wrap items-center gap-2">
            {form.scale.map((s) => (
              <label
                key={s.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${ratings[c.id] === s.value ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)]"}`}
              >
                <input
                  type="radio"
                  name={`${key}-${c.id}`}
                  value={s.value}
                  checked={ratings[c.id] === s.value}
                  onChange={() => change({ ...ratings, [c.id]: s.value })}
                  aria-label={`${c.title}: ${s.value} ${s.label}`}
                />
                {s.value}
              </label>
            ))}
            <span className="ml-auto text-sm font-semibold tabular-nums">
              {ratings[c.id] === undefined
                ? "—"
                : (ratings[c.id] * c.weight).toFixed(2)}{" "}
              /{" "}
              {(Math.max(...form.scale.map((s) => s.value)) * c.weight).toFixed(
                2,
              )}
            </span>
          </div>
        </fieldset>
      ))}
      <div className="flex justify-between rounded-lg bg-[var(--color-surface-muted)] p-3 text-sm">
        <span>
          Total · {criteria.filter((c) => ratings[c.id] !== undefined).length}/
          {criteria.length} rated
        </span>
        <strong className="tabular-nums">
          {sectionScore(criteria, ratings).toFixed(2)} /{" "}
          {sectionMaximum(criteria, form.scale).toFixed(2)}
        </strong>
      </div>
    </>
  );
  return (
    <div className="space-y-4">
      {roster.map((r, i) => (
        <details key={r.userId} open={i === 0} className={evaluationCard}>
          <summary className="cursor-pointer font-semibold">
            {r.name}{" "}
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">
              · Individual presentation
            </span>
          </summary>
          {section(
            form.presentation,
            answers.researchers[r.userId] || {},
            (ratings) =>
              onChange({
                ...answers,
                researchers: { ...answers.researchers, [r.userId]: ratings },
              }),
            r.userId,
          )}
        </details>
      ))}
      <details className={evaluationCard}>
        <summary className="cursor-pointer font-semibold">
          Group manuscript{" "}
          <span className="text-xs font-normal text-[var(--color-text-secondary)]">
            · Evaluated once
          </span>
        </summary>
        {section(
          form.manuscript,
          answers.manuscript,
          (ratings) => onChange({ ...answers, manuscript: ratings }),
          "manuscript",
        )}
      </details>
      <section className={evaluationCard}>
        <label className="block text-sm font-semibold">
          {form.feedbackLabel}
          <textarea
            disabled={disabled}
            className={`${evaluationInput} mt-3`}
            rows={4}
            placeholder={form.feedbackPrompt}
            value={answers.feedback}
            onChange={(e) => onChange({ ...answers, feedback: e.target.value })}
          />
        </label>
      </section>
      <fieldset disabled={disabled} className={evaluationCard}>
        <legend className="float-left mb-3 w-full font-semibold">
          Recommended defense result
        </legend>
        <div className="clear-both space-y-2">
          {defenseResults.map((result) => (
            <label
              key={result}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm"
            >
              <input
                type="radio"
                name="structured-result"
                checked={answers.recommendation === result}
                onChange={() =>
                  onChange({ ...answers, recommendation: result })
                }
              />
              {defenseResultLabels[result]}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          The facilitator releases the official result separately. Revision and
          re-defense recommendations require written instructions.
        </p>
      </fieldset>
      {form.signatureRequired && (
        <section className={evaluationCard}>
          <label className="text-sm font-semibold">
            Electronic signature — type your full name
            <input
              disabled={disabled}
              className={`${evaluationInput} mt-2`}
              value={answers.signature}
              onChange={(e) =>
                onChange({ ...answers, signature: e.target.value })
              }
            />
          </label>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            By submitting, you attest that this is your final signed evaluation.
          </p>
        </section>
      )}
    </div>
  );
}
