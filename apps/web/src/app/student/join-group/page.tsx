"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";
import "../student-screens.css";

const personName = (person: any) =>
  person
    ? [person.firstName, person.lastName].filter(Boolean).join(" ")
    : "Not assigned";

export default function JoinResearchGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(
    (searchParams.get("code") || "").toUpperCase(),
  );
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewKind, setPreviewKind] = useState<"project" | "workspace">("project");

  const reviewGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setMessage(null);
    setPreview(null);
    setPreviewKind("project");
    try {
      const response = await apiClient.get<{ project: any }>(
        `/api/research/join/${code.trim().toUpperCase()}/preview`,
      );
      setPreview(response.project);
      setPreviewKind("project");
    } catch (error: any) {
      try {
        const response = await apiClient.get<{ workspace: any }>(`/api/workspaces/join/${code.trim().toUpperCase()}/preview`);
        setPreview(response.workspace);
        setPreviewKind("workspace");
      } catch {
        setMessage(error?.message || "This group code could not be found.");
      }
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    if (!preview) return;
    setJoining(true);
    setMessage(null);
    try {
      const response = previewKind === "workspace" ? await apiClient.post<{ workspace: { name: string } }>(`/api/workspaces/join/${code.trim().toUpperCase()}`) : await apiClient.post<{
        pendingApproval?: boolean;
        project: { title: string; groupName?: string | null };
      }>(`/api/research/join/${code.trim().toUpperCase()}`);
      const name = previewKind === "workspace" ? (response as { workspace: { name: string } }).workspace.name : ((response as { project: { title: string; groupName?: string | null } }).project.groupName || (response as { project: { title: string } }).project.title);
      setSuccess(true);
      if (previewKind === "workspace") {
        setMessage(`You joined ${name}. Add the research project when your group is ready.`);
        setTimeout(() => router.push("/student/dashboard?tab=group"), 900);
      } else if ((response as { pendingApproval?: boolean }).pendingApproval) {
        setMessage(`Your request to join ${name} was sent to the group leader.`);
      } else {
        setMessage(`You joined ${name}.`);
        setTimeout(() => router.push("/student/dashboard?tab=group"), 900);
      }
    } catch (error: any) {
      setMessage(error?.message || "This invitation could not be used.");
    } finally {
      setJoining(false);
    }
  };

  const accessLabel =
    preview?.accessMode === "PUBLIC_APPROVAL"
      ? "Leader approval required"
      : preview?.accessMode === "PUBLIC_OPEN"
        ? "Open group"
        : "Private invitation";

  return (
    <div className="rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <RoleBand
        eyebrow="Research workspace"
        title="Join a research group"
        titleId="student-join-title"
        meta="Enter the code from your group leader, review the project, then confirm."
      />
      <div className="stu-two">
        <section className="rh-panel" aria-labelledby="student-join-step">
          <div className="rh-head">
            <h2 id="student-join-step">{preview ? (previewKind === "workspace" ? "Workspace preview" : "Group preview") : "Enter your code"}</h2>
          </div>
          {!preview ? (
            <form onSubmit={reviewGroup}>
              <label className="stu-code-label" htmlFor="student-group-code">Research group code</label>
              <input
                id="student-group-code"
                className="stu-code"
                value={code}
                data-guide="group-code"
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                  setMessage(null);
                }}
                maxLength={32}
                autoFocus
                placeholder="ENTER CODE"
              />
              <button disabled={!code.trim() || loading} data-guide="group-review" className="rh-cta stu-wide-cta">
                {loading ? "Checking…" : "Review group"} {!loading && <i className="ti ti-arrow-right" aria-hidden="true" />}
              </button>
            </form>
          ) : (
            <>
              <div className="stu-preview">
                <span className="rh-pill">{accessLabel}</span>
                <h3 data-guide="group-preview">{preview.groupName || "Research group"}</h3>
                <p>{previewKind === "workspace" ? `${preview.projectCount || 0} research projects` : preview.title}</p>
                <dl>
                  <div><dt>Group leader</dt><dd>{personName(preview.leader)}</dd></div>
                  <div><dt>Program</dt><dd>{preview.program?.code || preview.program?.name}</dd></div>
                  <div><dt>Researchers</dt><dd>{preview.memberCount}</dd></div>
                  <div><dt>Adviser</dt><dd>{personName(preview.adviser)}</dd></div>
                </dl>
              </div>
              {!success && (
                <div className="stu-buttons">
                  <button type="button" className="rh-secondary" onClick={() => setPreview(null)}>Use another code</button>
                  <button type="button" className="rs-primary" onClick={() => void joinGroup()} disabled={joining}>
                    {joining ? "Submitting…" : preview.accessMode === "PUBLIC_APPROVAL" ? "Request to join" : "Join group"}
                  </button>
                </div>
              )}
            </>
          )}
          {message && (
            <div className="stu-notice" data-tone={success ? "done" : "attention"} style={{ marginTop: 12 }} role={success ? "status" : "alert"}>
              <i className={`ti ${success ? "ti-circle-check" : "ti-alert-circle"}`} aria-hidden="true" />
              <div className="stu-notice-text"><strong>{message}</strong></div>
            </div>
          )}
          <button type="button" className="stu-link-button" onClick={() => router.push("/student/dashboard?tab=group")}>Back to My Projects</button>
        </section>
        <aside className="rh-panel" aria-labelledby="student-join-how">
          <div className="rh-head"><h2 id="student-join-how">How joining works</h2></div>
          <ol className="stu-steps">
            <li><span><strong>Get the code</strong><small>Ask your group leader for the group code.</small></span></li>
            <li><span><strong>Review the group</strong><small>Check the project, leader and adviser.</small></span></li>
            <li><span><strong>Join or request</strong><small>Some groups need the leader's approval.</small></span></li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
