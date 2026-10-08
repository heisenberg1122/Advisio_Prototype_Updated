"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/Skeleton";

type Mapping = {
  key: string;
  label: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  preferredFontSize: number;
  minimumFontSize: number;
  lineHeight: number;
  alignment: "LEFT" | "CENTER" | "RIGHT";
  multiline: boolean;
  maximumLines?: number;
  overflowPolicy:
    | "SHRINK"
    | "WRAP"
    | "APPENDIX"
    | "CONTINUATION_PAGE"
    | "REJECT";
  required: boolean;
};
const recommendationKeys = [
  "panelistName",
  "researchTitle",
  "defenseDate",
  "recommendation",
  "strengths",
  "weaknesses",
  "requiredRevisions",
  "technicalRecommendations",
  "additionalRemarks",
  "generatedAt",
];
const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const newMapping = (key = ""): Mapping => ({
  key,
  label: key,
  pageNumber: 1,
  x: 0.1,
  y: 0.1,
  width: 0.35,
  height: 0.08,
  preferredFontSize: 9,
  minimumFontSize: 8,
  lineHeight: 1.2,
  alignment: "LEFT",
  multiline: [
    "strengths",
    "weaknesses",
    "requiredRevisions",
    "technicalRecommendations",
    "additionalRemarks",
    "remarks",
  ].includes(key),
  overflowPolicy: [
    "strengths",
    "weaknesses",
    "requiredRevisions",
    "technicalRecommendations",
    "additionalRemarks",
    "remarks",
  ].includes(key)
    ? "APPENDIX"
    : "SHRINK",
  required: ["panelistName", "researchTitle", "recommendation"].includes(key),
});

export function DefensePacketConfigurator({
  session,
  onClose,
  onSaved,
}: {
  session: any;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [uploadedVersions, setUploadedVersions] = useState<any[]>([]);
  const { data, isLoading: packetLoading } = useQuery({
    queryKey: ["defense-packet-config", session.id],
    queryFn: () =>
      apiClient
        .get<any>(`/api/defense-sessions/${session.id}/review-packet`)
        .catch(() => ({ packet: null })),
  });
  const { data: templateData, isLoading: templatesLoading } = useQuery({
    queryKey: ["evaluation-templates", session.research?.researchTypeId],
    queryFn: () =>
      apiClient.get<any>("/api/evaluation-templates", {
        params: { researchTypeId: session.research?.researchTypeId },
      }),
    enabled: Boolean(session.research?.researchTypeId),
  });
  const projectVersions = useMemo(
    () =>
      (session.research?.documents || []).flatMap((document: any) =>
        (document.versions || [])
          .filter((version: any) => version.mimeType === "application/pdf")
          .map((version: any) => ({
            ...version,
            title: document.title,
            documentType: document.documentType,
          })),
      ),
    [session],
  );
  const versions = [...uploadedVersions, ...projectVersions];
  const criteria = templateData?.templates?.[0]?.criteria || [];
  const evaluationKeys = [
    "panelistName",
    "researchTitle",
    "defenseDate",
    "totalScore",
    "recommendation",
    "remarks",
    ...criteria.flatMap((item: any) => [
      `criteria.${item.id}.score`,
      `criteria.${item.id}.comment`,
    ]),
  ];
  const [manuscriptVersionId, setManuscriptVersionId] = useState("");
  const [similarityReportVersionId, setSimilarityReportVersionId] =
    useState("");
  const [recommendationTemplateVersionId, setRecommendationTemplateVersionId] =
    useState("");
  const [evaluationTemplateVersionId, setEvaluationTemplateVersionId] =
    useState("");
  const [reviewDeadline, setReviewDeadline] = useState("");
  const [recommendationMappings, setRecommendationMappings] = useState<
    Mapping[]
  >([]);
  const [evaluationMappings, setEvaluationMappings] = useState<Mapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const packet = data?.packet;
    if (!packet) return;
    setManuscriptVersionId(packet.manuscriptVersionId || "");
    setSimilarityReportVersionId(packet.similarityReportVersionId || "");
    setRecommendationTemplateVersionId(
      packet.recommendationTemplateVersionId || "",
    );
    setEvaluationTemplateVersionId(packet.evaluationTemplateVersionId || "");
    setReviewDeadline(
      packet.reviewDeadline
        ? new Date(packet.reviewDeadline).toISOString().slice(0, 16)
        : "",
    );
    setRecommendationMappings(
      Array.isArray(packet.recommendationFieldMappings)
        ? packet.recommendationFieldMappings.map((item: Mapping) => ({
            ...newMapping(item.key),
            ...item,
          }))
        : [],
    );
    setEvaluationMappings(
      Array.isArray(packet.evaluationFieldMappings)
        ? packet.evaluationFieldMappings.map((item: Mapping) => ({
            ...newMapping(item.key),
            ...item,
          }))
        : [],
    );
  }, [data]);

  const updateMapping = (
    setItems: React.Dispatch<React.SetStateAction<Mapping[]>>,
    index: number,
    patch: Partial<Mapping>,
  ) =>
    setItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  const save = async (publish: boolean) => {
    setSaving(true);
    setError("");
    try {
      await apiClient.put(`/api/defense-sessions/${session.id}/review-packet`, {
        manuscriptVersionId,
        similarityReportVersionId: similarityReportVersionId || null,
        recommendationTemplateVersionId:
          recommendationTemplateVersionId || null,
        evaluationTemplateVersionId: evaluationTemplateVersionId || null,
        reviewDeadline: reviewDeadline || null,
        recommendationFieldMappings: recommendationMappings,
        evaluationFieldMappings: evaluationMappings,
        publish,
      });
      onSaved(
        publish
          ? "Defense review packet published to accepted panelists."
          : "Defense packet draft saved.",
      );
    } catch (reason: any) {
      setError(reason.message || "Unable to save the defense packet.");
    } finally {
      setSaving(false);
    }
  };

  const uploadPacketFile = async (file: File | undefined, kind: string) => {
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const token = localStorage.getItem("advisio_token");
      const response = await fetch(
        `${apiBase}/api/defense-sessions/${session.id}/review-packet/files`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to upload the PDF.");
      setUploadedVersions((current) => [body.version, ...current]);
      if (kind === "SIMILARITY_REPORT")
        setSimilarityReportVersionId(body.version.id);
      if (kind === "RECOMMENDATION_TEMPLATE")
        setRecommendationTemplateVersionId(body.version.id);
      if (kind === "EVALUATION_TEMPLATE")
        setEvaluationTemplateVersionId(body.version.id);
    } catch (reason: any) {
      setError(reason.message || "Unable to upload the PDF.");
    } finally {
      setSaving(false);
    }
  };

  const MappingEditor = ({
    title,
    keys,
    items,
    setItems,
  }: {
    title: string;
    keys: string[];
    items: Mapping[];
    setItems: React.Dispatch<React.SetStateAction<Mapping[]>>;
  }) => (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-[#173f63]">{title}</h3>
          <p className="mt-1 text-[10px] text-slate-500">
            Coordinates use 0–1 values from the top-left of the PDF page.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setItems((current) => [...current, newMapping(keys[0])])
          }
          className="rounded-lg border px-3 py-2 text-xs font-bold"
        >
          Add field
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={`${item.key}-${index}`}
            className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[2fr_repeat(7,70px)_32px]"
          >
            <select
              value={item.key}
              onChange={(event) =>
                updateMapping(setItems, index, {
                  key: event.target.value,
                  label: event.target.value,
                  multiline: [
                    "strengths",
                    "weaknesses",
                    "requiredRevisions",
                    "technicalRecommendations",
                    "additionalRemarks",
                    "remarks",
                  ].includes(event.target.value),
                  overflowPolicy: [
                    "strengths",
                    "weaknesses",
                    "requiredRevisions",
                    "technicalRecommendations",
                    "additionalRemarks",
                    "remarks",
                  ].includes(event.target.value)
                    ? "APPENDIX"
                    : "SHRINK",
                })
              }
              className="rounded border bg-white px-2 text-xs"
            >
              {keys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            {[
              ["pageNumber", "Page"],
              ["x", "X"],
              ["y", "Y"],
              ["width", "Width"],
              ["height", "Height"],
              ["preferredFontSize", "Font"],
              ["minimumFontSize", "Min"],
            ].map(([key, label]) => (
              <label key={key} className="text-[9px] font-bold text-slate-400">
                {label}
                <input
                  type="number"
                  step={
                    key === "pageNumber" || key.includes("FontSize") ? 1 : 0.01
                  }
                  value={(item as any)[key]}
                  onChange={(event) =>
                    updateMapping(setItems, index, {
                      [key]: Number(event.target.value),
                    })
                  }
                  className="mt-1 w-full rounded border p-1 text-xs text-slate-700"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() =>
                setItems((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              className="text-rose-500"
            >
              <i className="ti ti-trash" />
            </button>
            <div className="md:col-span-full grid gap-3 md:grid-cols-4">
              <label className="flex items-center gap-2 text-[10px] text-slate-500">
                <input
                  type="checkbox"
                  checked={item.multiline}
                  onChange={(event) =>
                    updateMapping(setItems, index, {
                      multiline: event.target.checked,
                    })
                  }
                />
                Wrap long text into multiple lines
              </label>
              <label className="text-[10px] font-bold text-slate-500">
                Overflow
                <select
                  value={item.overflowPolicy}
                  onChange={(event) =>
                    updateMapping(setItems, index, {
                      overflowPolicy: event.target
                        .value as Mapping["overflowPolicy"],
                    })
                  }
                  className="ml-2 rounded border bg-white p-1"
                >
                  <option value="APPENDIX">Appendix</option>
                  <option value="CONTINUATION_PAGE">Continuation page</option>
                  <option value="SHRINK">Shrink to fit</option>
                  <option value="WRAP">Wrap or reject</option>
                  <option value="REJECT">Reject overflow</option>
                </select>
              </label>
              <label className="text-[10px] font-bold text-slate-500">
                Alignment
                <select
                  value={item.alignment}
                  onChange={(event) =>
                    updateMapping(setItems, index, {
                      alignment: event.target.value as Mapping["alignment"],
                    })
                  }
                  className="ml-2 rounded border bg-white p-1"
                >
                  <option value="LEFT">Left</option>
                  <option value="CENTER">Center</option>
                  <option value="RIGHT">Right</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-[10px] text-slate-500">
                <input
                  type="checkbox"
                  checked={item.required}
                  onChange={(event) =>
                    updateMapping(setItems, index, {
                      required: event.target.checked,
                    })
                  }
                />
                Required value
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  if (packetLoading || templatesLoading) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4">
        <div role="status" aria-busy="true" className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <span className="sr-only">Loading defense packet configuration</span>
          <div className="flex items-center justify-between border-b p-5"><div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-6 w-72 max-w-[65vw]" /><Skeleton className="h-3 w-52" /></div><Skeleton className="h-9 w-9 rounded-lg" /></div>
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="space-y-4 rounded-xl border border-slate-200 p-5"><Skeleton className="h-5 w-40" /><Skeleton className="h-11 w-full rounded-lg" /><Skeleton className="h-11 w-full rounded-lg" /><Skeleton className="h-24 w-full rounded-lg" /></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#d98d00]">
              Professor publishing
            </p>
            <h2 className="mt-1 text-xl font-black text-[#102f49]">
              Configure defense review packet
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              {session.research?.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"
          >
            <i className="ti ti-x" />
          </button>
        </header>
        <div className="space-y-5 p-5">
          <section className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">
              Eligible manuscript PDF
              <select
                value={manuscriptVersionId}
                onChange={(event) => setManuscriptVersionId(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border bg-white px-3"
              >
                <option value="">Select manuscript…</option>
                {versions.map((version: any) => (
                  <option key={version.id} value={version.id}>
                    {version.title} · v{version.versionNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              Optional similarity report
              <select
                value={similarityReportVersionId}
                onChange={(event) =>
                  setSimilarityReportVersionId(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-lg border bg-white px-3"
              >
                <option value="">None</option>
                {versions.map((version: any) => (
                  <option key={version.id} value={version.id}>
                    {version.title} · v{version.versionNumber}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-[10px] font-normal text-slate-400">
                Or upload a new similarity PDF
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={saving}
                onChange={(event) =>
                  uploadPacketFile(event.target.files?.[0], "SIMILARITY_REPORT")
                }
                className="mt-1 block w-full text-[10px] font-normal"
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Recommendation PDF template
              <select
                value={recommendationTemplateVersionId}
                onChange={(event) =>
                  setRecommendationTemplateVersionId(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-lg border bg-white px-3"
              >
                <option value="">None</option>
                {versions.map((version: any) => (
                  <option key={version.id} value={version.id}>
                    {version.title} · v{version.versionNumber}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-[10px] font-normal text-slate-400">
                Or upload the professor’s template
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={saving}
                onChange={(event) =>
                  uploadPacketFile(
                    event.target.files?.[0],
                    "RECOMMENDATION_TEMPLATE",
                  )
                }
                className="mt-1 block w-full text-[10px] font-normal"
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Evaluation PDF template
              <select
                value={evaluationTemplateVersionId}
                onChange={(event) =>
                  setEvaluationTemplateVersionId(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-lg border bg-white px-3"
              >
                <option value="">None</option>
                {versions.map((version: any) => (
                  <option key={version.id} value={version.id}>
                    {version.title} · v{version.versionNumber}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-[10px] font-normal text-slate-400">
                Or upload the professor’s rubric PDF
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={saving}
                onChange={(event) =>
                  uploadPacketFile(
                    event.target.files?.[0],
                    "EVALUATION_TEMPLATE",
                  )
                }
                className="mt-1 block w-full text-[10px] font-normal"
              />
            </label>
            <label className="text-xs font-bold text-slate-600 md:col-span-2">
              Panelist review deadline
              <input
                type="datetime-local"
                value={reviewDeadline}
                onChange={(event) => setReviewDeadline(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border px-3"
              />
            </label>
          </section>
          {recommendationTemplateVersionId && (
            <MappingEditor
              title="Recommendation PDF field mapping"
              keys={recommendationKeys}
              items={recommendationMappings}
              setItems={setRecommendationMappings}
            />
          )}
          {evaluationTemplateVersionId && (
            <MappingEditor
              title="Evaluation PDF field mapping"
              keys={evaluationKeys}
              items={evaluationMappings}
              setItems={setEvaluationMappings}
            />
          )}
          {error && (
            <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
              {error}
            </p>
          )}
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4">
          <button
            onClick={onClose}
            className="rounded-xl border px-5 py-2.5 text-sm font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            disabled={saving || !manuscriptVersionId}
            onClick={() => save(false)}
            className="rounded-xl border border-[#173f63] px-5 py-2.5 text-sm font-extrabold text-[#173f63] disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            disabled={saving || !manuscriptVersionId}
            onClick={() => save(true)}
            className="rounded-xl bg-[#f6a800] px-5 py-2.5 text-sm font-extrabold text-[#102f49] disabled:opacity-50"
          >
            Publish to panelists
          </button>
        </footer>
      </div>
    </div>
  );
}
