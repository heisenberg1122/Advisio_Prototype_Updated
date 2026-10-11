import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

type GuideResource = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
};

type MilestoneAttachment = {
  id: string;
  type: "GUIDE" | "LINK" | "PDF" | "FILE";
  title: string;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  workflowResource?: GuideResource | null;
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function MilestoneAttachmentsCard({
  stageId,
  workflowId,
}: {
  stageId: string;
  workflowId?: string | null;
}) {
  const [picker, setPicker] = useState<"guide" | "link" | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pdfInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["milestone-attachments", stageId],
    queryFn: () =>
      apiClient.get<{ attachments: MilestoneAttachment[] }>(
        `/api/workflows/stages/${stageId}/attachments`,
      ),
    enabled: Boolean(stageId),
  });
  const { data: guideData } = useQuery({
    queryKey: ["workflow-resources", workflowId],
    queryFn: () =>
      apiClient.get<{ resources: GuideResource[] }>(
        `/api/workflows/${workflowId}/resources`,
      ),
    enabled: Boolean(workflowId),
  });
  const attachments = data?.attachments || [];
  const guides = guideData?.resources || [];

  const attachGuide = async (resource: GuideResource) => {
    setBusy(true);
    setNotice("");
    try {
      await apiClient.post(`/api/workflows/stages/${stageId}/attachments`, {
        type: "GUIDE",
        workflowResourceId: resource.id,
      });
      await refetch();
      setPicker(null);
    } catch (error: any) {
      setNotice(error?.message || "The guide could not be attached.");
    } finally {
      setBusy(false);
    }
  };

  const attachLink = async () => {
    if (!linkUrl.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      await apiClient.post(`/api/workflows/stages/${stageId}/attachments`, {
        type: "LINK",
        title: linkTitle.trim(),
        url: linkUrl.trim(),
      });
      await refetch();
      setLinkTitle("");
      setLinkUrl("");
      setPicker(null);
    } catch (error: any) {
      setNotice(error?.message || "The link could not be attached.");
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File | undefined, type: "PDF" | "FILE") => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData();
      form.append("type", type);
      form.append("title", file.name);
      form.append("file", file);
      await apiClient.upload(
        `/api/workflows/stages/${stageId}/attachments`,
        form,
      );
      await refetch();
    } catch (error: any) {
      setNotice(error?.message || "The file could not be attached.");
    } finally {
      setBusy(false);
      if (pdfInput.current) pdfInput.current.value = "";
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const remove = async (attachment: MilestoneAttachment) => {
    setBusy(true);
    setNotice("");
    try {
      await apiClient.delete(
        `/api/workflows/stage-attachments/${attachment.id}`,
      );
      await refetch();
    } catch (error: any) {
      setNotice(error?.message || "The attachment could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  const openAttachment = async (attachment: MilestoneAttachment) => {
    if (attachment.type === "LINK" && attachment.url) {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const endpoint =
        attachment.type === "GUIDE" && attachment.workflowResource
          ? `/api/workflows/resources/${attachment.workflowResource.id}/file`
          : `/api/workflows/stage-attachments/${attachment.id}/file`;
      const blob = await apiClient.file(endpoint);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      setNotice(error?.message || "The attachment could not be opened.");
    }
  };

  const choices = [
    {
      label: "Guide template",
      help: "Choose shared material",
      icon: "ti-books",
      action: () => setPicker(picker === "guide" ? null : "guide"),
    },
    {
      label: "PDF",
      help: "Upload a PDF",
      icon: "ti-file-type-pdf",
      action: () => pdfInput.current?.click(),
    },
    {
      label: "Link",
      help: "Add a web address",
      icon: "ti-link",
      action: () => setPicker(picker === "link" ? null : "link"),
    },
    {
      label: "File",
      help: "Upload another file",
      icon: "ti-paperclip",
      action: () => fileInput.current?.click(),
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-[#102f49]">Attached</h3>
          <p className="mt-1 text-sm text-slate-500">
            Share references researchers may need to complete this milestone.
          </p>
        </div>
        {attachments.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
            {attachments.length}
          </span>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {attachments.map((attachment) => {
            const displayFile =
              attachment.workflowResource?.fileName || attachment.fileName;
            const icon =
              attachment.type === "LINK"
                ? "ti-link"
                : attachment.type === "GUIDE"
                  ? "ti-books"
                  : attachment.type === "PDF"
                    ? "ti-file-type-pdf"
                    : "ti-file";
            return (
              <div key={attachment.id} className="flex items-center gap-3 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#173f63]">
                  <i className={`ti ${icon} text-xl`} />
                </span>
                <button
                  type="button"
                  onClick={() => void openAttachment(attachment)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-extrabold text-[#102f49]">
                    {attachment.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">
                    {attachment.type === "GUIDE"
                      ? `Guide template · ${displayFile || "Shared material"}`
                      : attachment.type === "LINK"
                        ? attachment.url
                        : [displayFile, formatBytes(attachment.fileSize)]
                            .filter(Boolean)
                            .join(" · ")}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(attachment)}
                  aria-label={`Remove ${attachment.title}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {choices.map((choice) => (
          <button
            key={choice.label}
            type="button"
            disabled={busy}
            onClick={choice.action}
            className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#173f63]/40 hover:bg-blue-50/50 disabled:opacity-50"
          >
            <i className={`ti ${choice.icon} text-xl text-[#173f63]`} />
            <span className="mt-2 block text-xs font-extrabold text-[#102f49]">
              {choice.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">
              {choice.help}
            </span>
          </button>
        ))}
      </div>
      <input
        ref={pdfInput}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => void uploadFile(event.target.files?.[0], "PDF")}
      />
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(event) => void uploadFile(event.target.files?.[0], "FILE")}
      />

      {picker === "guide" && (
        <div className="mt-3 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-[#102f49]">
            Materials from the guide library
          </p>
          {guides.length === 0 ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              No guide templates are available yet. Add one from Guides &amp;
              templates first.
            </p>
          ) : (
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {guides.map((guide) => (
                <button
                  key={guide.id}
                  type="button"
                  disabled={
                    busy ||
                    attachments.some(
                      (item) => item.workflowResource?.id === guide.id,
                    )
                  }
                  onClick={() => void attachGuide(guide)}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left disabled:opacity-45"
                >
                  <i className="ti ti-file-description text-lg text-[#173f63]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-700">
                      {guide.title}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {guide.fileName}
                    </span>
                  </span>
                  <i className="ti ti-plus text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {picker === "link" && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-[#102f49]">Add a link</p>
          <input
            value={linkTitle}
            onChange={(event) => setLinkTitle(event.target.value)}
            maxLength={180}
            placeholder="Link title (optional)"
            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
          />
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            type="url"
            placeholder="https://…"
            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
          />
          <button
            type="button"
            disabled={busy || !linkUrl.trim()}
            onClick={() => void attachLink()}
            className="rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            Attach link
          </button>
        </div>
      )}

      {isLoading && (
        <p className="mt-3 text-xs text-slate-400">
          Loading attached materials…
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {notice}
        </p>
      )}
      <p className="mt-3 text-[11px] text-slate-400">
        Maximum upload size: 10 MB. Potentially unsafe executable files are not
        accepted.
      </p>
    </section>
  );
}
