"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { DocumentPreviewSkeleton, ListPageSkeleton } from "@/components/ui/Skeleton";

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const fileUrl = (fileId?: string | null, download = false) =>
  fileId
    ? `${apiBase}/api/documents/files/${fileId}${download ? "?download=1" : ""}`
    : "";
const authHeaders = () => {
  const token = localStorage.getItem("advisio_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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

export function PanelistReviewPackets() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["defense-review-packets"],
    queryFn: () =>
      apiClient.get<{ sessions: any[] }>("/api/defense-review-packets"),
  });
  const sessions = data?.sessions || [];
  const [selectedId, setSelectedId] = useState("");
  const selected =
    sessions.find((item: any) => item.id === selectedId) || sessions[0] || null;
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["defense-review-packet", selected?.id],
    queryFn: () =>
      apiClient.get<any>(`/api/defense-sessions/${selected.id}/review-packet`),
    enabled: Boolean(selected?.id),
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

  useEffect(() => {
    if (recommendationPreviewUrl) URL.revokeObjectURL(recommendationPreviewUrl);
    setRecommendationPreviewUrl("");
    setLayoutReport(null);
    // Preview files are scoped to the selected immutable defense packet.
  }, [selected?.id]);

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
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setPreviewUrl(objectUrl);
      })
      .catch((reason) => active && setNotice(reason.message))
      .finally(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewVersion?.id]);

  const manuscriptVersions =
    detail?.packet?.manuscriptVersion?.document?.versions || [];
  const latestVersion = manuscriptVersions[0];
  const progress = useMemo(
    () => [
      { label: "Manuscript opened", done: Boolean(previewUrl) },
      { label: "Review saved", done: Boolean(detail?.review) },
      {
        label: "Recommendation generated",
        done: detail?.recommendation?.status === "LOCKED",
      },
      {
        label: "Evaluation locked",
        done: selected?.evaluations?.[0]?.status === "LOCKED",
      },
    ],
    [previewUrl, detail, selected],
  );

  const saveReview = async (reviewed = false) => {
    if (!selected) return;
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
    if (recommendationPreviewUrl) URL.revokeObjectURL(recommendationPreviewUrl);
    setRecommendationPreviewUrl("");
    setLayoutReport(null);
  };

  const saveRecommendation = async () => {
    if (!selected) return;
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
    if (!selected) return;
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
      if (recommendationPreviewUrl)
        URL.revokeObjectURL(recommendationPreviewUrl);
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
    if (!selected || !recommendationPreviewUrl) return;
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
      URL.revokeObjectURL(recommendationPreviewUrl);
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

  if (isLoading)
    return <ListPageSkeleton rows={4} className="p-0 sm:p-0 lg:p-0" />;
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">
        Unable to load defense packets.
      </div>
    );
  if (!sessions.length)
    return (
      <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
        <i className="ti ti-file-search text-4xl text-slate-300" />
        <h3 className="mt-3 font-extrabold text-[#173f63]">
          No manuscript is ready for review
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          An accepted defense invitation and a packet published by the professor
          are required.
        </p>
      </div>
    );

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
      <div className="grid min-h-[720px] gap-4 xl:grid-cols-[290px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#d98d00]">
              Ready for review
            </p>
            <h2 className="mt-1 text-lg font-black text-[#102f49]">
              Defense packets
            </h2>
          </div>
          <div className="space-y-2">
            {sessions.map((session: any) => (
              <button
                key={session.id}
                onClick={() => {
                  setSelectedId(session.id);
                  setTab("manuscript");
                }}
                className={`w-full rounded-xl border p-3 text-left ${session.id === selected.id ? "border-[#f6a800] bg-amber-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <p className="line-clamp-2 text-sm font-extrabold text-[#173f63]">
                  {session.research.title}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {session.research.researchType?.name || "Defense"}
                </p>
                <p className="mt-2 text-[10px] font-bold text-slate-400">
                  {session.scheduledStart
                    ? new Date(session.scheduledStart).toLocaleString()
                    : "Schedule pending"}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-4 border-t p-2">
            <p className="text-[10px] font-extrabold uppercase text-slate-400">
              Packet progress
            </p>
            {progress.map((item) => (
              <div
                key={item.label}
                className="mt-2 flex items-center gap-2 text-xs"
              >
                <i
                  className={`ti ${item.done ? "ti-circle-check text-emerald-600" : "ti-circle-dashed text-slate-300"}`}
                />
                <span
                  className={
                    item.done ? "font-bold text-slate-700" : "text-slate-400"
                  }
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#102f49]">
                  {selected.research.title}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Published manuscript v
                  {detail?.packet?.manuscriptVersion?.versionNumber} · Review
                  deadline{" "}
                  {detail?.packet?.reviewDeadline
                    ? new Date(detail.packet.reviewDeadline).toLocaleString()
                    : "not specified"}
                </p>
              </div>
              {latestVersion && (
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-extrabold text-emerald-700">
                  Latest version: v{latestVersion.versionNumber}
                </span>
              )}
            </div>
            <nav className="mt-5 flex gap-1 overflow-x-auto">
              {(
                [
                  ["manuscript", "Manuscript"],
                  ["notes", "Notes & revisions"],
                  ["recommendation", "Recommendation form"],
                  ["evaluation", "Evaluation rubric"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-extrabold ${tab === id ? "bg-[#173f63] text-white" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {notice && (
              <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
                {notice}
              </p>
            )}
          </header>

          {detailLoading ? (
            <DocumentPreviewSkeleton className="min-h-[590px]" />
          ) : tab === "manuscript" ? (
            <div className="grid gap-4 p-4 lg:grid-cols-[1fr_250px]">
              <section className="min-h-[590px] overflow-hidden rounded-xl border bg-slate-800">
                {previewUrl ? (
                  <iframe
                    title="Defense manuscript PDF"
                    src={`${previewUrl}#page=${pageNumber}&view=FitH`}
                    className="h-[650px] w-full bg-white"
                  />
                ) : (
                  <DocumentPreviewSkeleton className="h-[590px] min-h-0" />
                )}
              </section>
              <aside className="space-y-4">
                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-extrabold text-[#173f63]">
                    Document versions
                  </h3>
                  <div className="mt-3 space-y-2">
                    {manuscriptVersions.map((version: any, index: number) => (
                      <button
                        key={version.id}
                        onClick={() =>
                          setPreviewVersion({
                            ...version,
                            document: detail.packet.manuscriptVersion.document,
                          })
                        }
                        className={`w-full rounded-lg border p-2 text-left text-xs ${previewVersion?.id === version.id ? "border-[#f6a800] bg-amber-50" : "border-slate-200"}`}
                      >
                        <span className="font-bold">
                          Version {version.versionNumber}
                        </span>
                        {index === 0 && (
                          <span className="ml-2 text-[9px] font-extrabold text-emerald-600">
                            LATEST
                          </span>
                        )}
                        <span className="mt-1 block truncate text-[10px] text-slate-400">
                          {version.fileName}
                        </span>
                      </button>
                    ))}
                  </div>
                  {previewVersion?.googleDriveFileId && (
                    <button
                      onClick={() => downloadVersion(previewVersion)}
                      className="mt-3 block rounded-lg bg-[#173f63] px-3 py-2 text-center text-xs font-extrabold text-white"
                    >
                      Download selected PDF
                    </button>
                  )}
                  {detail?.downloads?.[0] && (
                    <p className="mt-2 text-[9px] text-slate-400">
                      Last downloaded{" "}
                      {new Date(detail.downloads[0].createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-extrabold text-[#173f63]">
                    Page comment
                  </h3>
                  <label className="mt-3 block text-[10px] font-bold text-slate-500">
                    Page number
                    <input
                      type="number"
                      min="1"
                      value={pageNumber}
                      onChange={(event) =>
                        setPageNumber(Math.max(1, Number(event.target.value)))
                      }
                      className="mt-1 w-full rounded-lg border p-2 text-sm"
                    />
                  </label>
                  <textarea
                    value={annotationText}
                    onChange={(event) => setAnnotationText(event.target.value)}
                    placeholder="Add a page-specific observation…"
                    className="mt-3 min-h-24 w-full rounded-lg border p-2 text-xs"
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
                    className="mt-2 w-full rounded-lg bg-[#f6a800] px-3 py-2 text-xs font-extrabold text-[#102f49] disabled:opacity-50"
                  >
                    Add page comment
                  </button>
                </div>
                {detail?.packet?.similarityReport?.googleDriveFileId && (
                  <button
                    onClick={() =>
                      setPreviewVersion(detail.packet.similarityReport)
                    }
                    className="w-full rounded-xl border border-violet-200 bg-violet-50 p-4 text-left text-xs font-extrabold text-violet-700"
                  >
                    <i className="ti ti-fingerprint mr-2" />
                    Open similarity report
                  </button>
                )}
              </aside>
            </div>
          ) : tab === "notes" ? (
            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <section>
                <h3 className="font-extrabold text-[#173f63]">
                  Private panelist notes
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  These notes are visible only to you.
                </p>
                <textarea
                  value={privateNotes}
                  onChange={(event) => setPrivateNotes(event.target.value)}
                  className="mt-3 min-h-44 w-full rounded-xl border p-3 text-sm"
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
                            className="text-[10px] font-extrabold text-sky-700"
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
                        <p className="mt-2 text-xs leading-5 text-slate-700">
                          {item.comment}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed p-5 text-center text-xs text-slate-400">
                      No page comments yet.
                    </p>
                  )}
                </div>
              </section>
              <section>
                <h3 className="font-extrabold text-[#173f63]">
                  Required-revision checklist
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Prepare actionable corrections for the deliberation and
                  recommendation form.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newChecklist}
                    onChange={(event) => setNewChecklist(event.target.value)}
                    placeholder="Add a revision item"
                    className="min-w-0 flex-1 rounded-lg border px-3 text-sm"
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
                    className="rounded-lg bg-[#173f63] px-3 py-2 text-xs font-bold text-white"
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
                          className={`text-xs font-semibold ${item.resolved ? "text-slate-400 line-through" : "text-slate-700"}`}
                        >
                          {item.text}
                        </p>
                        <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
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
                    className="flex-1 rounded-xl border px-4 py-3 text-xs font-extrabold text-[#173f63]"
                  >
                    Save privately
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => saveReview(true)}
                    className="flex-1 rounded-xl bg-[#f6a800] px-4 py-3 text-xs font-extrabold text-[#102f49]"
                  >
                    Mark reviewed
                  </button>
                </div>
              </section>
            </div>
          ) : tab === "recommendation" ? (
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
              <section>
                <h3 className="font-extrabold text-[#173f63]">
                  Panel recommendation
                </h3>
                <p className="mt-1 text-xs text-slate-500">
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
                      className="text-xs font-bold text-slate-600"
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
                  <label className="text-xs font-bold text-slate-600">
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
                    className="rounded-xl border px-5 py-3 text-xs font-extrabold text-[#173f63]"
                  >
                    Save draft
                  </button>
                  <button
                    disabled={
                      saving || detail?.recommendation?.status === "LOCKED"
                    }
                    onClick={generateRecommendationPreview}
                    className="rounded-xl bg-[#f6a800] px-5 py-3 text-xs font-extrabold text-[#102f49]"
                  >
                    Generate preview
                  </button>
                </div>
                {recommendationPreviewUrl && (
                  <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-sky-900">
                          Preview ready for review
                        </p>
                        <p className="mt-1 text-xs text-sky-700">
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
                        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white"
                      >
                        Confirm & lock
                      </button>
                    </div>
                    <iframe
                      title="Recommendation PDF preview"
                      src={recommendationPreviewUrl}
                      className="mt-4 h-[620px] w-full rounded-lg border bg-white"
                    />
                    <div className="mt-3 space-y-1">
                      {layoutReport?.fields
                        ?.filter((item: any) => item.warning)
                        .map((item: any) => (
                          <p
                            key={item.key}
                            className="text-[10px] font-bold text-amber-700"
                          >
                            {item.label}: {item.warning}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
              </section>
              <aside className="rounded-xl border bg-slate-50 p-4">
                <h3 className="text-sm font-extrabold text-[#173f63]">
                  Generated document
                </h3>
                {detail?.recommendation?.generatedVersion ? (
                  <>
                    <p className="mt-3 break-all text-xs font-bold text-slate-600">
                      {detail.recommendation.generatedVersion.fileName}
                    </p>
                    <p className="mt-2 text-[10px] text-emerald-600">
                      Locked · integrity hash recorded
                    </p>
                    <button
                      onClick={() => {
                        setPreviewVersion(
                          detail.recommendation.generatedVersion,
                        );
                        setTab("manuscript");
                      }}
                      className="mt-4 w-full rounded-lg border bg-white px-3 py-2 text-xs font-bold"
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
                      className="mt-2 w-full rounded-lg bg-[#173f63] px-3 py-2 text-xs font-extrabold text-white"
                    >
                      <i className="ti ti-signature mr-1" />
                      Add signature
                    </button>
                  </>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-slate-400">
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
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                The professor’s criteria are available in the live evaluation
                workspace when the defense begins. Final submission
                automatically produces the mapped evaluation PDF when an
                evaluation template is included in this packet.
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
        </main>
      </div>
    </>
  );
}
