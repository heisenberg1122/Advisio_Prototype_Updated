"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { EmptyNote } from "@/components/ui/advisio";
import { Button } from "@/components/ui/Button";
import { PacketManuscriptWorkspace } from "./PacketManuscriptWorkspace";
import { StructuredEvaluationWorkspace } from "./StructuredEvaluationWorkspace";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import {
  DocumentPreviewSkeleton,
  ListPageSkeleton,
} from "@/components/ui/Skeleton";

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const fileUrl = (fileId?: string | null, download = false) =>
  fileId
    ? `${apiBase}/api/documents/files/${fileId}${download ? "?download=1" : ""}`
    : "";
const authHeaders = () => {
  const token = localStorage.getItem("advisio_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(value))
    : "Not specified";

type Annotation = {
  id: string;
  pageNumber: number;
  comment: string;
  createdAt: string;
};
type ChecklistItem = {
  id: string;
  text: string;
  required: boolean;
  resolved: boolean;
};

type ReviewFilter = "all" | "pending" | "history";

type DefensePacketSummary = {
  id: string;
  research: { title: string };
  scheduledStart?: string | null;
  manuscriptReviews?: { reviewedAt?: string | null }[];
  packetDocumentReviews?: unknown[];
  packet?: { evaluationMode?: string };
  structuredEvaluations?: { lockedAt?: string | null }[];
  pdfEvaluations?: { status: string }[];
  evaluations?: { status: string; totalScore?: number | null }[];
};

export function DefensePacketReview({
  sessionId,
  initialFilter,
}: {
  sessionId: string;
  initialFilter: ReviewFilter;
}) {
  const [reviewFilter, setReviewFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState(sessionId);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["defense-review-packets"],
    queryFn: () =>
      apiClient.get<{ sessions: DefensePacketSummary[] }>("/api/defense-review-packets"),
  });

  if (isLoading)
    return <ListPageSkeleton rows={4} className="p-0 sm:p-0 lg:p-0" />;
  if (error) {
    return (
      <div className="au-card" role="alert">
        <EmptyNote
          layout="row"
          tone="problem"
          icon="ti-alert-triangle"
          title="We couldn’t load your defense packets"
          text="Your connection may have dropped. Try again in a moment."
          action={<Button size="sm" variant="secondary" onClick={() => void refetch()}>Try again</Button>}
        />
      </div>
    );
  }

  const sessions = data?.sessions ?? [];
  if (!sessions.length) {
    return (
      <div data-guide="panelist-packet-empty" className="au-card">
        <EmptyNote
          layout="page"
          icon="ti-file-search"
          title="No defense packets are available"
          text="Manuscripts appear here after you accept a panel invitation and the coordinator publishes the packet."
          steps={["You accept a panel invitation", "The coordinator publishes the packet", "You review the manuscript"]}
        />
      </div>
    );
  }

  const visibleSessions = sessions.filter((session) => {
    const reviewed = Boolean(session.manuscriptReviews?.[0]?.reviewedAt);
    return reviewFilter === "all" || reviewed === (reviewFilter === "history");
  });
  const selectionUnavailable =
    selectedId && !sessions.some((session) => session.id === selectedId);
  const selected = selectionUnavailable
    ? undefined
    : visibleSessions.find((session) => session.id === selectedId) ?? visibleSessions[0];
  const selectClass = "mt-1.5 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm";

  return (
    <>
      <Card data-guide={selected ? "panelist-packet-list" : "panelist-packet-empty"}>
        <h2 className="text-lg font-bold">Choose a defense packet</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="min-w-0 text-sm font-semibold">
            Defense session
            <select
              className={selectClass}
              value={selected?.id ?? ""}
              disabled={!visibleSessions.length}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {!selected && <option value="" disabled>Select a defense</option>}
              {visibleSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.research.title} · {formatDateTime(session.scheduledStart)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Review status
            <select
              className={selectClass}
              value={reviewFilter}
              onChange={(event) => {
                setReviewFilter(event.target.value as ReviewFilter);
                setSelectedId("");
              }}
            >
              <option value="all">All defense packets</option>
              <option value="pending">Pending reviews</option>
              <option value="history">Review history</option>
            </select>
          </label>
        </div>
        {!selected && (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="status">
            {visibleSessions.length
              ? "The requested defense is unavailable in this view. Choose another session or change the review status."
              : "No defense packets match this review status."}
          </p>
        )}
      </Card>
      {selected && <DefensePacketDetails key={selected.id} selected={selected} />}
    </>
  );
}

function DefensePacketDetails({ selected }: { selected: DefensePacketSummary }) {
  const queryClient = useQueryClient();
  const { data: detail, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ["defense-review-packet", selected.id],
    queryFn: () =>
      apiClient.get<any>(`/api/defense-sessions/${selected.id}/review-packet`),
  });
  const [tab, setTab] = useState<
    "manuscript" | "notes" | "recommendation" | "evaluation"
  >("manuscript");
  const [previewVersion, setPreviewVersion] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [annotationText, setAnnotationText] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklist, setNewChecklist] = useState("");
  const [recommendation, setRecommendation] = useState<any>({
    recommendation: "MINOR_REVISION",
    strengths: "",
    weaknesses: "",
    requiredRevisions: "",
    technicalRecommendations: "",
    additionalRemarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [signing, setSigning] = useState<any | null>(null);
  const [recommendationPreviewUrl, setRecommendationPreviewUrl] = useState("");
  const [layoutReport, setLayoutReport] = useState<any>(null);

  useEffect(() => () => {
    if (recommendationPreviewUrl) URL.revokeObjectURL(recommendationPreviewUrl);
  }, [recommendationPreviewUrl]);

  useEffect(() => {
    if (!detail) return;
    setPrivateNotes(detail.review?.privateNotes || "");
    setAnnotations(
      Array.isArray(detail.review?.annotations)
        ? detail.review.annotations
        : [],
    );
    setChecklist(
      Array.isArray(detail.review?.revisionChecklist)
        ? detail.review.revisionChecklist
        : [],
    );
    setRecommendation((current: any) => ({
      ...current,
      ...(detail.recommendation?.responses || {}),
    }));
    setPreviewVersion(detail.packet?.manuscriptVersion || null);
  }, [detail]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!previewVersion?.googleDriveFileId) {
      setPreviewUrl("");
      return;
    }
    fetch(fileUrl(previewVersion.googleDriveFileId), { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to open this PDF.");
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((reason) => active && setNotice(reason.message))
      .finally(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewVersion?.id]);

  const publishedManuscript = detail?.packet?.manuscriptVersion || null;
  const progress = [
    { label: "Manuscript available", done: Boolean(publishedManuscript) },
    {
      label: "Latest manuscript review complete",
      done: Boolean(detail?.review?.reviewedAt),
    },
    {
      label: "Saved manuscript annotation history",
      done: Boolean(selected.packetDocumentReviews?.length),
    },
    {
      label: "Evaluation locked",
      done:
        selected.packet?.evaluationMode === "STRUCTURED"
          ? Boolean(selected.structuredEvaluations?.[0]?.lockedAt)
          : selected.packet?.evaluationMode === "PDF"
            ? selected.pdfEvaluations?.[0]?.status === "LOCKED"
            : selected.evaluations?.[0]?.status === "LOCKED",
    },
  ];

  const saveReview = async (reviewed = false) => {
    setSaving(true);
    setNotice("");
    try {
      await apiClient.put(
        `/api/defense-sessions/${selected.id}/manuscript-review`,
        { privateNotes, annotations, revisionChecklist: checklist, reviewed },
      );
      await queryClient.invalidateQueries({
        queryKey: ["defense-review-packet", selected.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["defense-review-packets"],
      });
      setNotice(
        reviewed
          ? "Manuscript review marked complete."
          : "Private review saved.",
      );
    } catch (reason: any) {
      setNotice(reason.message || "Unable to save the review.");
    } finally {
      setSaving(false);
    }
  };

  const updateRecommendation = (key: string, value: string) => {
    setRecommendation((current: any) => ({ ...current, [key]: value }));
    setRecommendationPreviewUrl("");
    setLayoutReport(null);
  };

  const saveRecommendation = async () => {
    setSaving(true);
    setNotice("");
    try {
      await apiClient.put<any>(
        `/api/defense-sessions/${selected.id}/recommendation`,
        { responses: recommendation },
      );
      await queryClient.invalidateQueries({
        queryKey: ["defense-review-packet", selected.id],
      });
      setRecommendationPreviewUrl("");
      setLayoutReport(null);
      setNotice(
        "Recommendation draft saved. Generate a preview before locking.",
      );
    } catch (reason: any) {
      setNotice(reason.message || "Unable to save the recommendation.");
    } finally {
      setSaving(false);
    }
  };

  const generateRecommendationPreview = async () => {
    setSaving(true);
    setNotice("");
    try {
      await apiClient.put(
        `/api/defense-sessions/${selected.id}/recommendation`,
        { responses: recommendation },
      );
      const result = await apiClient.post<any>(
        `/api/defense-sessions/${selected.id}/recommendation/preview`,
        {},
      );
      const response = await fetch(
        `${apiBase}/api/defense-sessions/${selected.id}/recommendation/preview`,
        { headers: authHeaders() },
      );
      if (!response.ok)
        throw new Error("Unable to load the generated preview.");
      setRecommendationPreviewUrl(URL.createObjectURL(await response.blob()));
      setLayoutReport(result.preview.layoutReport);
      await queryClient.invalidateQueries({
        queryKey: ["defense-review-packet", selected.id],
      });
      setNotice("Preview generated. Review every page before confirming.");
    } catch (reason: any) {
      setNotice(reason.message || "Unable to generate the preview.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRecommendation = async () => {
    if (!recommendationPreviewUrl) return;
    setSaving(true);
    setNotice("");
    try {
      const result = await apiClient.post<any>(
        `/api/defense-sessions/${selected.id}/recommendation/confirm`,
        {},
      );
      await queryClient.invalidateQueries({
        queryKey: ["defense-review-packet", selected.id],
      });
      setNotice(
        "Recommendation regenerated, locked, and stored as an official PDF.",
      );
      if (result.recommendation?.generatedVersion)
        setPreviewVersion(result.recommendation.generatedVersion);
      setRecommendationPreviewUrl("");
    } catch (reason: any) {
      setNotice(reason.message || "Unable to confirm the recommendation.");
    } finally {
      setSaving(false);
    }
  };

  const downloadVersion = async (version: any) => {
    if (!version?.googleDriveFileId) return;
    try {
      const response = await fetch(fileUrl(version.googleDriveFileId, true), {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error("Unable to download this PDF.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = version.fileName || "document.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      queryClient.invalidateQueries({
        queryKey: ["defense-review-packet", selected.id],
      });
    } catch (reason: any) {
      setNotice(reason.message || "Unable to download this PDF.");
    }
  };

  if (detailLoading) return <DocumentPreviewSkeleton className="min-h-[560px]" />;
  if (detailError || !detail) {
    return <Card role="alert">This defense packet is unavailable.</Card>;
  }

  return (
    <>
      {signing && (
        <DocumentSigningModal
          document={signing}
          onClose={() => setSigning(null)}
          onSigned={(message) => {
            setSigning(null);
            setNotice(message);
            queryClient.invalidateQueries({
              queryKey: ["defense-review-packet", selected.id],
            });
          }}
        />
      )}
      <section aria-label="Defense packet details" className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-card-soft)] dark:[&_h3]:text-white dark:[&_input]:border-white/10 dark:[&_input]:bg-[#101b2b] dark:[&_select]:border-white/10 dark:[&_select]:bg-[#101b2b] dark:[&_textarea]:border-white/10 dark:[&_textarea]:bg-[#101b2b]">
        <header className="border-b border-[var(--color-border)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[var(--color-text-primary)]">
                {selected.research.title}
              </h2>
              <p className="mt-1 text-base text-slate-500">
                Published manuscript v
                {detail?.packet?.manuscriptVersion?.versionNumber} · Review
                deadline{" "}
                {detail?.packet?.reviewDeadline
                  ? formatDateTime(detail.packet.reviewDeadline)
                  : "not specified"}
              </p>
            </div>
            {publishedManuscript && (
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                Published for defense: v{publishedManuscript.versionNumber}
              </span>
            )}
          </div>
          <ul aria-label="Review progress" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-text-secondary)]">
            {progress.map(({ label, done }) => (
              <li key={label} className="flex items-center gap-1.5">
                <i aria-hidden="true" className={`ti ${done ? "ti-circle-check text-emerald-600" : "ti-circle-dashed"}`} />
                <span className="sr-only">{done ? "Complete" : "Pending"}: </span>
                {label}
              </li>
            ))}
          </ul>
          <nav aria-label="Defense packet sections" className="mt-5 flex gap-1 overflow-x-auto">
            {(
              [
                ["manuscript", "Manuscript"],
                ["notes", "Notes & revisions"],
                ["recommendation", "Recommendation form"],
                ["evaluation", "Evaluation rubric"],
              ] as const
            )
              .filter(
                ([id]) =>
                  detail?.packet?.evaluationMode !== "STRUCTURED" ||
                  id !== "recommendation",
              )
              .map(([id, label]) => (
                <button
                  key={id}
                  data-guide={`panelist-${id}-tab`}
                  onClick={() => setTab(id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-extrabold ${tab === id ? "bg-[var(--color-primary)] text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"}`}
                >
                  {label}
                </button>
              ))}
          </nav>
          {notice && (
            <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-base font-bold text-sky-700">
              {notice}
            </p>
          )}
        </header>

        {tab === "manuscript" ? (
          !previewVersion || previewVersion.id === publishedManuscript?.id ? (
            <PacketManuscriptWorkspace
              key={selected.id}
              sessionId={selected.id}
            />
          ) : (
            <div className="grid gap-4 p-4 lg:grid-cols-[1fr_250px]">
              <section className="document-preview-stage min-h-[590px] overflow-hidden rounded-xl border border-[var(--color-border)]">
                {previewUrl ? (
                  <iframe
                    title="Defense manuscript PDF"
                    src={`${previewUrl}#page=${pageNumber}&view=FitH`}
                    className="document-preview-embed h-[650px] w-full"
                  />
                ) : (
                  <DocumentPreviewSkeleton className="h-[590px] min-h-0" />
                )}
              </section>
              <aside className="space-y-4">
                <div className="rounded-xl border p-4">
                  <h3 className="text-lg font-extrabold text-[#173f63]">
                    Published manuscript
                  </h3>
                  <div className="mt-3 space-y-2">
                    {publishedManuscript && (
                      <button
                        key={publishedManuscript.id}
                        onClick={() =>
                          setPreviewVersion({
                            ...publishedManuscript,
                            document:
                              detail.packet.manuscriptVersion.document,
                          })
                        }
                        className={`w-full rounded-lg border p-2 text-left text-sm ${previewVersion?.id === publishedManuscript.id ? "border-[#f6a800] bg-amber-50" : "border-slate-200"}`}
                      >
                        <span className="font-bold">
                          Version {publishedManuscript.versionNumber}
                        </span>
                        <span className="ml-2 text-sm font-extrabold text-emerald-600">
                          PUBLISHED FOR DEFENSE
                        </span>
                        <span className="mt-1 block truncate text-sm text-slate-400">
                          {publishedManuscript.fileName}
                        </span>
                      </button>
                    )}
                  </div>
                  {previewVersion?.googleDriveFileId && (
                    <button
                      onClick={() => downloadVersion(previewVersion)}
                      className="mt-3 block rounded-lg bg-[#173f63] px-3 py-2 text-center text-sm font-extrabold text-white"
                    >
                      Download selected PDF
                    </button>
                  )}
                  {detail?.downloads?.[0] && (
                    <p className="mt-2 text-base text-slate-400">
                      Last downloaded{" "}
                      {formatDateTime(detail.downloads[0].createdAt)}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border p-4">
                  <h3 className="text-lg font-extrabold text-[#173f63]">
                    Page comment
                  </h3>
                  <label className="mt-3 block text-sm font-bold text-slate-500">
                    Page number
                    <input
                      type="number"
                      min="1"
                      value={pageNumber}
                      onChange={(event) =>
                        setPageNumber(Math.max(1, Number(event.target.value)))
                      }
                      className="mt-1 w-full rounded-lg border p-2 text-base"
                    />
                  </label>
                  <textarea
                    value={annotationText}
                    onChange={(event) =>
                      setAnnotationText(event.target.value)
                    }
                    placeholder="Add a page-specific observation…"
                    className="mt-3 min-h-24 w-full rounded-lg border p-2 text-base"
                  />
                  <button
                    disabled={!annotationText.trim()}
                    onClick={() => {
                      setAnnotations((items) => [
                        ...items,
                        {
                          id: crypto.randomUUID(),
                          pageNumber,
                          comment: annotationText.trim(),
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                      setAnnotationText("");
                      setTab("notes");
                    }}
                    className="mt-2 w-full rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-3 py-2 text-sm font-extrabold text-white transition disabled:opacity-50"
                  >
                    Add page comment
                  </button>
                </div>
                {detail?.packet?.similarityReport?.googleDriveFileId && (
                  <button
                    onClick={() =>
                      setPreviewVersion(detail.packet.similarityReport)
                    }
                    className="w-full rounded-xl border border-violet-200 bg-violet-50 p-4 text-left text-sm font-extrabold text-violet-700"
                  >
                    <i className="ti ti-fingerprint mr-2" />
                    Open similarity report
                  </button>
                )}
              </aside>
            </div>
          )
        ) : tab === "notes" ? (
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <section>
              <h3 className="font-extrabold text-[#173f63]">
                Private panelist notes
              </h3>
              <p className="mt-1 text-base text-slate-500">
                These notes are visible only to you.
              </p>
              <textarea
                value={privateNotes}
                onChange={(event) => setPrivateNotes(event.target.value)}
                className="mt-3 min-h-44 w-full rounded-xl border p-3 text-base"
                placeholder="Record questions, observations, and discussion points…"
              />
              <h3 className="mt-6 font-extrabold text-[#173f63]">
                Page comments
              </h3>
              <div className="mt-3 space-y-2">
                {annotations.length ? (
                  annotations.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border bg-slate-50 p-3"
                    >
                      <div className="flex justify-between">
                        <button
                          onClick={() => {
                            setPageNumber(item.pageNumber);
                            setTab("manuscript");
                          }}
                          className="text-sm font-extrabold text-sky-700"
                        >
                          PAGE {item.pageNumber}
                        </button>
                        <button
                          onClick={() =>
                            setAnnotations((items) =>
                              items.filter((entry) => entry.id !== item.id),
                            )
                          }
                          className="text-rose-500"
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                      <p className="mt-2 text-base leading-5 text-slate-700">
                        {item.comment}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyNote layout="row" icon="ti-message-2" title="No page comments yet" text="Comments you add to this manuscript appear here." />
                )}
              </div>
            </section>
            <section>
              <h3 data-guide="panelist-notes" className="font-extrabold text-[#173f63]">
                Required-revision checklist
              </h3>
              <p className="mt-1 text-base text-slate-500">
                Prepare actionable corrections for deliberation and the
                written recommendation in your evaluation.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={newChecklist}
                  onChange={(event) => setNewChecklist(event.target.value)}
                  placeholder="Add a revision item"
                  className="min-w-0 flex-1 rounded-lg border px-3 text-base"
                />
                <button
                  disabled={!newChecklist.trim()}
                  onClick={() => {
                    setChecklist((items) => [
                      ...items,
                      {
                        id: crypto.randomUUID(),
                        text: newChecklist.trim(),
                        required: true,
                        resolved: false,
                      },
                    ]);
                    setNewChecklist("");
                  }}
                  className="rounded-lg bg-[#173f63] px-3 py-2 text-sm font-bold text-white"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border p-3"
                  >
                    <input
                      type="checkbox"
                      checked={item.resolved}
                      onChange={(event) =>
                        setChecklist((items) =>
                          items.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, resolved: event.target.checked }
                              : entry,
                          ),
                        )
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-base font-semibold ${item.resolved ? "text-slate-400 line-through" : "text-slate-700"}`}
                      >
                        {item.text}
                      </p>
                      <label className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(event) =>
                            setChecklist((items) =>
                              items.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      required: event.target.checked,
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        Required correction
                      </label>
                    </div>
                    <button
                      onClick={() =>
                        setChecklist((items) =>
                          items.filter((entry) => entry.id !== item.id),
                        )
                      }
                      className="text-rose-500"
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  disabled={saving}
                  onClick={() => saveReview(false)}
                  className="flex-1 rounded-xl border px-4 py-3 text-sm font-extrabold text-[#173f63]"
                >
                  Save privately
                </button>
                <button
                  disabled={saving}
                  onClick={() => saveReview(true)}
                  className="flex-1 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-3 text-sm font-extrabold text-white transition"
                >
                  Mark reviewed
                </button>
              </div>
            </section>
          </div>
        ) : detail?.packet?.evaluationMode === "STRUCTURED" ? (
          <div className="p-5">
            <StructuredEvaluationWorkspace
              key={selected.id}
              sessionId={selected.id}
            />
          </div>
        ) : tab === "recommendation" ? (
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
            <section>
              <h3 data-guide="panelist-recommendation" className="font-extrabold text-[#173f63]">
                Panel recommendation
              </h3>
              <p className="mt-1 text-base text-slate-500">
                Your answers will be mapped into the PDF template published by
                the professor.
              </p>
              <div className="mt-4 grid gap-4">
                {[
                  ["strengths", "Strengths"],
                  ["weaknesses", "Weaknesses"],
                  ["requiredRevisions", "Required revisions"],
                  ["technicalRecommendations", "Technical recommendations"],
                  ["additionalRemarks", "Additional remarks"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="text-sm font-bold text-slate-600"
                  >
                    {label}
                    <textarea
                      value={recommendation[key] || ""}
                      onChange={(event) =>
                        updateRecommendation(key, event.target.value)
                      }
                      rows={key === "requiredRevisions" ? 5 : 3}
                      className="mt-1.5 w-full rounded-xl border p-3 font-normal"
                    />
                  </label>
                ))}
                <label className="text-sm font-bold text-slate-600">
                  Final recommendation
                  <select
                    value={recommendation.recommendation}
                    onChange={(event) =>
                      updateRecommendation(
                        "recommendation",
                        event.target.value,
                      )
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3"
                  >
                    <option value="APPROVE">Approve</option>
                    <option value="MINOR_REVISION">Minor revisions</option>
                    <option value="MAJOR_REVISION">Major revisions</option>
                    <option value="REJECT">Reject</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  disabled={
                    saving || detail?.recommendation?.status === "LOCKED"
                  }
                  onClick={saveRecommendation}
                  className="rounded-xl border px-5 py-3 text-sm font-extrabold text-[#173f63]"
                >
                  Save draft
                </button>
                <button
                  disabled={
                    saving || detail?.recommendation?.status === "LOCKED"
                  }
                  onClick={generateRecommendationPreview}
                  className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-5 py-3 text-sm font-extrabold text-white transition"
                >
                  Generate preview
                </button>
              </div>
              {recommendationPreviewUrl && (
                <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-extrabold text-sky-900">
                        Preview ready for review
                      </p>
                      <p className="mt-1 text-base text-sky-700">
                        {layoutReport?.fields?.filter(
                          (item: any) =>
                            item.status === "MOVED_TO_APPENDIX" ||
                            item.status === "CONTINUED",
                        ).length || 0}{" "}
                        field(s) continued onto appendix pages ·{" "}
                        {layoutReport?.appendedPages || 0} appendix page(s)
                      </p>
                    </div>
                    <button
                      disabled={saving}
                      onClick={() =>
                        window.confirm(
                          "I reviewed the complete generated PDF. Lock this recommendation?",
                        ) && confirmRecommendation()
                      }
                      className="submission-action rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white"
                    >
                      Confirm & lock
                    </button>
                  </div>
                  <iframe
                    title="Recommendation PDF preview"
                    src={recommendationPreviewUrl}
                    className="document-preview-embed mt-4 h-[620px] w-full rounded-lg border"
                  />
                  <div className="mt-3 space-y-1">
                    {layoutReport?.fields
                      ?.filter((item: any) => item.warning)
                      .map((item: any) => (
                        <p
                          key={item.key}
                          className="text-base font-bold text-amber-700"
                        >
                          {item.label}: {item.warning}
                        </p>
                      ))}
                  </div>
                </div>
              )}
            </section>
            <aside className="rounded-xl border bg-slate-50 p-4">
              <h3 className="text-lg font-extrabold text-[#173f63]">
                Generated document
              </h3>
              {detail?.recommendation?.generatedVersion ? (
                <>
                  <p className="mt-3 break-all text-base font-bold text-slate-600">
                    {detail.recommendation.generatedVersion.fileName}
                  </p>
                  <p className="mt-2 text-base text-emerald-600">
                    Locked · integrity hash recorded
                  </p>
                  <button
                    onClick={() => {
                      setPreviewVersion(
                        detail.recommendation.generatedVersion,
                      );
                      setTab("manuscript");
                    }}
                    className="mt-4 w-full rounded-lg border bg-white px-3 py-2 text-sm font-bold"
                  >
                    Preview PDF
                  </button>
                  <button
                    onClick={() =>
                      setSigning({
                        versionId: detail.recommendation.generatedVersion.id,
                        docName: "Panelist Recommendation",
                        groupName: selected.research.title,
                        fileUrl: `/api/documents/files/${detail.recommendation.generatedVersion.googleDriveFileId}`,
                      })
                    }
                    className="mt-2 w-full rounded-lg bg-[#173f63] px-3 py-2 text-sm font-extrabold text-white"
                  >
                    <i className="ti ti-signature mr-1" />
                    Add signature
                  </button>
                </>
              ) : (
                <p className="mt-3 text-base leading-5 text-slate-400">
                  Submit the final form to generate the mapped recommendation
                  PDF.
                </p>
              )}
            </aside>
          </div>
        ) : (
          <div className="p-6">
            <h3 className="text-lg font-extrabold text-[#173f63]">
              Evaluation rubric
            </h3>
            <p className="mt-2 max-w-2xl text-base leading-6 text-slate-500">
              The professor’s criteria are available in the live evaluation
              workspace when the defense begins. Final submission
              automatically produces the mapped evaluation PDF when an
              evaluation template is included in these defense documents.
            </p>
            {selected.evaluations?.[0] ? (
              <div className="mt-5 rounded-xl border p-4">
                <div className="flex justify-between text-sm">
                  <span>Status</span>
                  <strong>{selected.evaluations[0].status}</strong>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span>Total score</span>
                  <strong>
                    {selected.evaluations[0].totalScore || "Draft"}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                Evaluation scoring unlocks when the professor starts the
                defense.
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
