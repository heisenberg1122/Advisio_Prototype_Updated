import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import {
  StructuredEvaluationFields,
  emptyStructuredAnswers,
  evaluationButton,
  evaluationCard,
} from "@/components/defense/StructuredEvaluationFields";
import { PdfDocumentPreview } from "@/components/documents/PdfDocumentPreview";
import { openEvaluationPdf } from "@/components/professor/ConsolidatedEvaluations";
export function StructuredEvaluationWorkspace({
  sessionId,
}: {
  sessionId: string;
}) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["structured-evaluation", sessionId],
    queryFn: () =>
      apiClient.get<any>(
        `/api/defense-sessions/${sessionId}/structured-evaluation`,
      ),
    refetchOnWindowFocus: false,
    refetchInterval: 3000,
  });
  const [answers, setAnswers] = useState(emptyStructuredAnswers),
    [item, setItem] = useState<any>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [review, setReview] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const revision = useRef(0),
    saved = useRef(""),
    latest = useRef(answers),
    inflight = useRef<Promise<any> | null>(null),
    initialized = useRef(false),
    halt = useRef(false);
  latest.current = answers;
  useEffect(() => {
    if (query.data && !initialized.current) {
      initialized.current = true;
      const e = query.data.evaluation,
        a = e?.answers || emptyStructuredAnswers();
      setAnswers(a);
      setItem(e);
      revision.current = e?.revision || 0;
      saved.current = JSON.stringify(a);
      setReady(true);
    }
  }, [query.data]);
  const save = async () => {
    while (inflight.current) await inflight.current;
    const a = latest.current,
      serialized = JSON.stringify(a);
    if (serialized === saved.current && revision.current > 0) return;
    const pending = apiClient
      .put<any>(`/api/defense-sessions/${sessionId}/structured-evaluation`, {
        revision: revision.current,
        answers: a,
      })
      .then((result) => {
        revision.current = result.evaluation.revision;
        saved.current = serialized;
        setItem(result.evaluation);
        setStatus("Draft saved");
        return result.evaluation;
      });
    inflight.current = pending;
    try {
      return await pending;
    } finally {
      if (inflight.current === pending) inflight.current = null;
    }
  };
  useEffect(() => {
    if (
      !ready ||
      item?.lockedAt ||
      query.data?.sessionStatus !== "LIVE" ||
      review ||
      halt.current ||
      JSON.stringify(answers) === saved.current
    )
      return;
    const timer = setTimeout(() => {
      void save().catch((e: any) => {
        halt.current = true;
        setError(e.message);
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [answers, ready, item?.lockedAt, query.data?.sessionStatus, review]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const preview = async () => {
    setBusy(true);
    setError("");
    try {
      await save();
      const result = await apiClient.post<any>(
        `/api/defense-sessions/${sessionId}/structured-evaluation/preview`,
        { revision: revision.current },
      );
      setItem(result.evaluation);
      setUrl(await openEvaluationPdf(sessionId, user!.id));
      setConfirmed(false);
      setReview(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await apiClient.post<any>(
        `/api/defense-sessions/${sessionId}/structured-evaluation/submit`,
        {
          revision: revision.current,
          previewHash: item.previewHash,
          confirmed,
        },
      );
      setItem(result.evaluation);
      setReview(false);
      setStatus("Final evaluation submitted and locked");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (query.isPending || (!ready && !query.isError))
    return <p>Loading digital evaluation…</p>;
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  const snapshot = query.data.snapshot,
    locked = Boolean(item?.lockedAt),
    editable = query.data.sessionStatus === "LIVE" && !locked;
  return (
    <div className="space-y-4">
      <section className={evaluationCard}>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {snapshot.researchTitle}
        </p>
        <h2 className="mt-1 text-xl font-bold">{snapshot.spec.name}</h2>
        {locked && query.data.receipt && (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] p-3 text-sm">
            <p className="font-semibold">
              Submission receipt · Ledger record #{query.data.receipt.sequence}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Recorded{" "}
              {new Date(query.data.receipt.recordedAt).toLocaleString()}
            </p>
            <code className="mt-1 block break-all text-xs">
              {query.data.receipt.eventHash}
            </code>
          </div>
        )}
        <p className="mt-2 text-sm">
          {locked
            ? "Final evaluation · Locked"
            : editable
              ? "Live defense · Your private draft"
              : "Pre-defense · Review the criteria; scoring opens when the defense starts."}
        </p>
      </section>
      {review ? (
        <section className={evaluationCard}>
          <h3 className="mb-3 font-bold">
            Review your generated evaluation PDF
          </h3>
          <PdfDocumentPreview url={url} />
          <label className="my-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm these ratings and recommendations are final. My submitted
            evaluation will be locked.
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              className={evaluationButton}
              onClick={() => setReview(false)}
            >
              Back to editing
            </button>
            <button
              disabled={!confirmed || busy}
              className={`submission-action ${evaluationButton} bg-[var(--color-primary)] text-white`}
              onClick={submit}
            >
              Submit final evaluation
            </button>
          </div>
        </section>
      ) : (
        <StructuredEvaluationFields
          form={snapshot.spec}
          roster={snapshot.roster}
          answers={answers}
          disabled={!editable || busy}
          onChange={(value) => {
            setAnswers(value);
            setStatus("Unsaved changes");
            setError("");
          }}
        />
      )}
      {!review && editable && (
        <div className="flex flex-wrap justify-between gap-3">
          <span className="text-sm" aria-live="polite">
            {status}
          </span>
          <div className="flex gap-3">
            <button
              disabled={busy}
              className={evaluationButton}
              onClick={async () => {
                setBusy(true);
                try {
                  await save();
                  halt.current = false;
                  setError("");
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save draft
            </button>
            <button
              disabled={busy}
              className={`${evaluationButton} bg-[var(--color-primary)] text-white`}
              onClick={preview}
            >
              Review evaluation PDF
            </button>
          </div>
        </div>
      )}
      {locked && (
        <button
          className={evaluationButton}
          onClick={async () => {
            try {
              const pdf = await openEvaluationPdf(sessionId, user!.id);
              setUrl(pdf);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          View locked evaluation PDF
        </button>
      )}
      {locked && url && <PdfDocumentPreview url={url} />}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
