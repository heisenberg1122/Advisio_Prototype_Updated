import { useState } from "react";
import {
  defaultStructuredForm,
  sectionMaximum,
  type StructuredForm,
  type EvaluationRoster,
} from "@research-management/validations";
import {
  StructuredEvaluationFields,
  evaluationCard,
  evaluationInput,
  evaluationButton,
  emptyStructuredAnswers,
} from "@/components/defense/StructuredEvaluationFields";

export function StructuredFormEditor({
  form,
  onChange,
  roster,
  disabled = false,
}: {
  form: StructuredForm;
  onChange: (form: StructuredForm) => void;
  roster: EvaluationRoster;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState("criteria"),
    [preview, setPreview] = useState(emptyStructuredAnswers);
  const update = (patch: Partial<StructuredForm>) =>
    onChange({ ...form, ...patch });
  const section = (key: "presentation" | "manuscript", title: string) => (
    <section className={evaluationCard}>
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        <span className="text-sm">
          Maximum: {sectionMaximum(form[key], form.scale).toFixed(2)}
          {key === "presentation" ? " per researcher" : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        {key === "presentation"
          ? `Repeated automatically for all ${roster.length} researchers.`
          : "One rubric for the group or solo project."}
      </p>
      <div className="mt-4 space-y-3">
        {form[key].map((c, i) => (
          <div
            key={c.id}
            className="rounded-lg border border-[var(--color-border)] p-3"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
              <label className="text-xs">
                Criterion
                <input
                  disabled={disabled}
                  className={`${evaluationInput} mt-1`}
                  value={c.title}
                  onChange={(e) =>
                    update({
                      [key]: form[key].map((r) =>
                        r.id === c.id ? { ...r, title: e.target.value } : r,
                      ),
                    })
                  }
                />
              </label>
              <label className="text-xs">
                Weight
                <input
                  disabled={disabled}
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  className={`${evaluationInput} mt-1`}
                  value={c.weight}
                  onChange={(e) =>
                    update({
                      [key]: form[key].map((r) =>
                        r.id === c.id
                          ? { ...r, weight: Number(e.target.value) }
                          : r,
                      ),
                    })
                  }
                />
              </label>
            </div>
            <label className="mt-2 block text-xs">
              Description (optional)
              <input
                disabled={disabled}
                className={`${evaluationInput} mt-1`}
                value={c.description}
                onChange={(e) =>
                  update({
                    [key]: form[key].map((r) =>
                      r.id === c.id ? { ...r, description: e.target.value } : r,
                    ),
                  })
                }
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <button
                disabled={disabled || i === 0}
                type="button"
                onClick={() => {
                  const rows = [...form[key]];
                  [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
                  update({ [key]: rows });
                }}
              >
                ↑ Move up
              </button>
              <button
                disabled={disabled || i === form[key].length - 1}
                type="button"
                onClick={() => {
                  const rows = [...form[key]];
                  [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
                  update({ [key]: rows });
                }}
              >
                ↓ Move down
              </button>
              <button
                disabled={disabled || form[key].length === 1}
                type="button"
                onClick={() =>
                  update({ [key]: form[key].filter((r) => r.id !== c.id) })
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className={`${evaluationButton} mt-4`}
        disabled={disabled || form[key].length >= 30}
        type="button"
        onClick={() =>
          update({
            [key]: [
              ...form[key],
              {
                id: crypto.randomUUID(),
                title: "New criterion",
                description: "",
                weight: 1,
              },
            ],
          })
        }
      >
        + Add criterion
      </button>
    </section>
  );
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        Template name
        <input
          disabled={disabled}
          className={`${evaluationInput} mt-2`}
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {[
          ["criteria", "Criteria & weights"],
          ["scale", "Rating scale"],
          ["result", "Feedback & result"],
          ["preview", "Form preview"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className={`${evaluationButton} ${tab === key ? "bg-[var(--color-primary)] text-white" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "criteria" && (
        <>
          {section("presentation", "Individual presentation")}
          {section("manuscript", "Group manuscript")}
        </>
      )}
      {tab === "scale" && (
        <section className={evaluationCard}>
          <h3 className="font-bold">
            Rating scale · {form.scale.length} levels
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Score = selected rating × criterion weight. Maximums update
            automatically.
          </p>
          {form.scale.map((s, i) => (
            <label key={i} className="mt-3 flex items-center gap-3">
              <span className="w-5 text-center">{s.value}</span>
              <input
                aria-label={`Rating ${s.value} label`}
                disabled={disabled}
                className={evaluationInput}
                value={s.label}
                onChange={(e) =>
                  update({
                    scale: form.scale.map((r, j) =>
                      j === i ? { ...r, label: e.target.value } : r,
                    ),
                  })
                }
              />
              <button
                disabled={disabled || form.scale.length <= 2}
                type="button"
                aria-label={`Remove rating ${s.value}`}
                onClick={() =>
                  update({
                    scale: form.scale
                      .filter((_, j) => j !== i)
                      .map((r, j) => ({ ...r, value: j + 1 })),
                  })
                }
              >
                Remove
              </button>
            </label>
          ))}
          <button
            className={`${evaluationButton} mt-4`}
            disabled={disabled || form.scale.length >= 10}
            type="button"
            onClick={() =>
              update({
                scale: [
                  ...form.scale,
                  {
                    value: form.scale.length + 1,
                    label:
                      form.scale.length === 5
                        ? "Excellent"
                        : `Level ${form.scale.length + 1}`,
                  },
                ],
              })
            }
          >
            + Add rating level
          </button>
        </section>
      )}
      {tab === "result" && (
        <section className={evaluationCard}>
          <label className="block text-sm">
            Feedback field label
            <input
              disabled={disabled}
              className={`${evaluationInput} mt-2`}
              value={form.feedbackLabel}
              onChange={(e) => update({ feedbackLabel: e.target.value })}
            />
          </label>
          <label className="mt-4 block text-sm">
            Prompt
            <textarea
              disabled={disabled}
              rows={3}
              className={`${evaluationInput} mt-2`}
              value={form.feedbackPrompt}
              onChange={(e) => update({ feedbackPrompt: e.target.value })}
            />
          </label>
          <p className="my-4 text-sm">
            Defense results: Approved · Minor Revisions · Major Revisions ·
            Re-Defense Required · Disapproved
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              disabled={disabled}
              type="checkbox"
              checked={form.signatureRequired}
              onChange={(e) => update({ signatureRequired: e.target.checked })}
            />
            Require a typed electronic signature before submission
          </label>
        </section>
      )}
      {tab === "preview" && (
        <StructuredEvaluationFields
          form={form}
          roster={roster}
          answers={preview}
          onChange={setPreview}
        />
      )}
    </div>
  );
}
export { defaultStructuredForm };
