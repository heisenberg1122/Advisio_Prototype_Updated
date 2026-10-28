import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { structuredFormSchema } from "@research-management/validations";
import { apiClient } from "@/lib/api-client";
import {
  StructuredFormEditor,
  defaultStructuredForm,
} from "./StructuredFormEditor";
import {
  evaluationCard,
  evaluationInput,
  evaluationButton,
} from "@/components/defense/StructuredEvaluationFields";
import { ConsolidatedEvaluations } from "./ConsolidatedEvaluations";

export function StructuredDefensePacket({
  session,
  onClose,
  onSaved,
}: {
  session: any;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState(defaultStructuredForm),
    [manuscript, setManuscript] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [similarityReport, setSimilarityReport] = useState<any>(null),
    [tab, setTab] = useState("packet");
  const query = useQuery({
    queryKey: ["structured-form", session.id],
    queryFn: () =>
      apiClient.get<any>(`/api/defense-sessions/${session.id}/structured-form`),
  });
  const templates = useQuery({
    queryKey: ["structured-evaluation-templates"],
    queryFn: () => apiClient.get<any>("/api/structured-evaluation-templates"),
  });
  useEffect(() => {
    if (query.data) {
      setSimilarityReport(query.data.similarityReport || null);
      setForm(query.data.snapshot?.spec || defaultStructuredForm);
      setManuscript(
        query.data.manuscriptVersionId ||
          (query.data.candidates.length === 1
            ? query.data.candidates[0].id
            : ""),
      );
    }
  }, [query.data]);
  const locked = ["LIVE", "DELIBERATION", "COMPLETED", "CANCELLED"].includes(
      query.data?.sessionStatus,
    ),
    published = query.data?.packetStatus === "PUBLISHED";
  const save = async (publish: boolean) => {
    setSaving(true);
    setError("");
    try {
      const spec = structuredFormSchema.parse(form);
      await apiClient.put(
        `/api/defense-sessions/${session.id}/structured-form`,
        {
          spec,
          manuscriptVersionId: manuscript,
          similarityReportVersionId: similarityReport?.id || null,
          publish,
          expectedMappingVersion: query.data?.mappingVersion || 0,
          publicationReason: reason,
        },
      );
      onSaved(
        publish
          ? "Defense packet published with the digital evaluation form."
          : "Defense packet draft saved.",
      );
    } catch (e: any) {
      setError(e.issues?.[0]?.message || e.message);
    } finally {
      setSaving(false);
    }
  };
  const saveTemplate = async () => {
    setSaving(true);
    try {
      await apiClient.post("/api/structured-evaluation-templates", {
        spec: structuredFormSchema.parse(form),
      });
      await templates.refetch();
      setError("");
    } catch (e: any) {
      setError(e.issues?.[0]?.message || e.message);
    } finally {
      setSaving(false);
    }
  };
  const uploadSupporting = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "SIMILARITY_REPORT");
      const result = await apiClient.upload<any>(
        `/api/defense-sessions/${session.id}/review-packet/files`,
        body,
      );
      setSimilarityReport(result.version);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Defense review packet"
        className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Defense / {session.research?.groupName || session.research?.title}
            </p>
            <h2 className="mt-1 text-xl font-bold">Review packet</h2>
          </div>
          <button
            aria-label="Close packet"
            className={evaluationButton}
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {["packet", "evaluation", "results"].map((v) => (
              <button
                key={v}
                className={`${evaluationButton} ${v === tab ? "bg-[var(--color-primary)] text-white" : ""}`}
                onClick={() => setTab(v)}
              >
                {v === "packet"
                  ? "Packet overview"
                  : v === "evaluation"
                    ? "Configure evaluation"
                    : "Consolidated evaluations"}
              </button>
            ))}
          </div>
          {query.isPending ? (
            <p>Loading review packet…</p>
          ) : query.isError ? (
            <p role="alert">{query.error.message}</p>
          ) : tab === "results" ? (
            <ConsolidatedEvaluations sessionId={session.id} />
          ) : (
            <>
              {tab === "packet" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className={evaluationCard}>
                    <h3 className="font-bold">Approved defense manuscript</h3>
                    <p className="my-2 text-xs text-[var(--color-text-secondary)]">
                      Fetched from this session’s Defense Eligibility milestone.
                    </p>
                    <select
                      disabled={locked}
                      aria-label="Approved defense manuscript"
                      className={evaluationInput}
                      value={manuscript}
                      onChange={(e) => setManuscript(e.target.value)}
                    >
                      <option value="">
                        {query.data.candidates.length
                          ? "Choose the approved manuscript"
                          : "No approved milestone manuscript available"}
                      </option>
                      {query.data.candidates.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {v.fileName} · Version {v.versionNumber}
                        </option>
                      ))}
                      {query.data.manuscriptVersionId &&
                        !query.data.candidates.some(
                          (v: any) => v.id === query.data.manuscriptVersionId,
                        ) && (
                          <option value={query.data.manuscriptVersionId}>
                            Published manuscript — historical snapshot
                          </option>
                        )}
                    </select>
                    <p className="mt-3 text-xs">
                      Status:{" "}
                      {published
                        ? "Published · saved manuscript snapshot"
                        : "Draft packet"}
                    </p>
                  </section>
                  <section className={evaluationCard}>
                    <h3 className="font-bold">Researcher roster</h3>
                    <ul className="my-3 space-y-2 text-sm">
                      {(query.data.snapshot?.roster || query.data.roster).map(
                        (r: any) => (
                          <li key={r.userId}>{r.name}</li>
                        ),
                      )}
                    </ul>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Names are filled automatically. One presentation rubric
                      per researcher.
                    </p>
                  </section>
                  <section className={evaluationCard}>
                    <h3 className="font-bold">Digital evaluation form</h3>
                    <p className="mt-2">{form.name}</p>
                    <p className="mt-2 text-sm">
                      {form.scale.length} rating levels ·{" "}
                      {form.presentation.length} presentation criteria ·{" "}
                      {form.manuscript.length} manuscript criteria
                    </p>
                    <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                      Includes written feedback and recommended defense result.
                      Evaluation PDFs are generated after panelist submission.
                    </p>
                    <button
                      className={`${evaluationButton} mt-3`}
                      onClick={() => setTab("evaluation")}
                    >
                      Configure form
                    </button>
                  </section>
                  <section className={evaluationCard}>
                    <h3 className="font-bold">Publication snapshot</h3>
                    <p className="mt-2 text-sm">
                      Publishing saves this roster, rubric, approved manuscript,
                      and accepted panel assignments for the session.
                    </p>
                    <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                      Materials become fixed when the defense starts. All
                      required panelists must accept before publication.
                    </p>
                  </section>
                  <section className={evaluationCard}>
                    <h3 className="font-bold">
                      Supporting document (optional)
                    </h3>
                    <p className="mt-2 text-sm">
                      {similarityReport?.fileName ||
                        "No similarity report attached."}
                    </p>
                    {!locked && (
                      <label className="mt-3 block text-xs">
                        Attach a similarity report PDF
                        <input
                          type="file"
                          accept="application/pdf"
                          disabled={saving}
                          className="mt-2 block max-w-full text-sm"
                          onChange={(e) =>
                            void uploadSupporting(e.target.files?.[0])
                          }
                        />
                      </label>
                    )}
                    {!locked && similarityReport && (
                      <button
                        className={`${evaluationButton} mt-3`}
                        onClick={() => setSimilarityReport(null)}
                      >
                        Remove attachment from packet
                      </button>
                    )}
                  </section>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <select
                      disabled={locked}
                      className={`${evaluationInput} max-w-lg`}
                      aria-label="Reusable evaluation template"
                      defaultValue=""
                      onChange={(e) => {
                        const t = templates.data?.templates.find(
                          (t: any) => t.id === e.target.value,
                        );
                        if (t) setForm(t.spec);
                      }}
                    >
                      <option value="">
                        Choose a saved template (optional)
                      </option>
                      {templates.data?.templates.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.spec.name} ·{" "}
                          {new Date(t.createdAt).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={saving || locked}
                      className={evaluationButton}
                      onClick={saveTemplate}
                    >
                      Save as reusable template
                    </button>
                  </div>
                  <StructuredFormEditor
                    form={form}
                    onChange={setForm}
                    roster={query.data.snapshot?.roster || query.data.roster}
                    disabled={locked}
                  />
                </>
              )}
              {published && !locked && (
                <label className="block text-sm">
                  Reason for replacing published materials
                  <input
                    className={`${evaluationInput} mt-2`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="At least 10 characters"
                  />
                </label>
              )}
              {!locked && (
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    disabled={saving || published}
                    className={evaluationButton}
                    onClick={() => save(false)}
                  >
                    Save draft
                  </button>
                  <button
                    disabled={saving || !manuscript}
                    className={`${evaluationButton} bg-[var(--color-primary)] text-white`}
                    onClick={() => save(true)}
                  >
                    {saving
                      ? "Saving…"
                      : published
                        ? "Publish approved replacement"
                        : "Publish packet"}
                  </button>
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
