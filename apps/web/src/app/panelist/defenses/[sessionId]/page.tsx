"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { deanDefenseReturn } from "@/lib/dean-defense-navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { EmptyNote, ListRow, PageBand, RowIcon, SectionCard, StatusDot, type StatusTone } from "@/components/ui/advisio";
import "./defense-workspace.css";

const TZ = "Asia/Manila";
const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TZ,
      }).format(new Date(value))
    : "Not scheduled";
const shortDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: TZ,
      }).format(new Date(value))
    : "";
const readable = (value?: string | null, fallback = "Not recorded") =>
  value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : fallback;
const fullName = (user?: { firstName?: string; lastName?: string } | null) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  "Research member";
const initials = (user?: { firstName?: string; lastName?: string } | null) =>
  [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((part) => String(part)[0])
    .join("")
    .toUpperCase() || "?";

function sessionStatus(status?: string | null): { tone: StatusTone; label: string } {
  switch (status) {
    case "LIVE": return { tone: "live", label: "Live" };
    case "SCHEDULED": return { tone: "done", label: "Confirmed" };
    case "PENDING_ACKNOWLEDGEMENT": return { tone: "waiting", label: "Tentative" };
    case "NEEDS_RESCHEDULING": return { tone: "attention", label: "Rescheduling" };
    case "COMPLETED": return { tone: "neutral", label: "Completed" };
    case "CANCELLED": return { tone: "attention", label: "Cancelled" };
    default: return { tone: "brand", label: readable(status, "Scheduled") };
  }
}

function attendanceMode(session: any) {
  if (session.deliveryMode === "HYBRID") return "Hybrid";
  if (session.deliveryMode === "ONLINE") return "Online";
  if (session.deliveryMode === "ON_SITE") return "On-site";
  const venue = session.venue || session.defenseEvent?.venue;
  const meetingUrl = session.meetingUrl || session.defenseEvent?.meetingUrl;
  if (venue && meetingUrl) return "Hybrid";
  if (meetingUrl) return "Online";
  if (venue) return "On-site";
  return "To be announced";
}

type StepState = "done" | "focus" | "todo" | "current" | "pending";

function durationSince(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function ProgressStrip({ steps }: { steps: Array<{ label: string; detail: string; state: StepState }> }) {
  const icons: Record<StepState, string> = {
    done: "ti-check",
    focus: "ti-point-filled",
    todo: "ti-circle-dashed",
    current: "ti-circle-dashed",
    pending: "ti-circle",
  };
  return (
    <ol className="au-card pw-steps" aria-label="Defense progress">
      {steps.map((step) => (
        <li key={step.label} className="pw-step" data-state={step.state} aria-current={step.state === "focus" ? "step" : undefined}>
          <span className="pw-chip">
            <i className={`ti ${icons[step.state]} pw-step-icon`} aria-hidden="true" />
            <span className="min-w-0">
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function PanelistDefenseWorkspacePage() {
  const { sessionId = "" } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const deanReturn = deanDefenseReturn(useSearchParams().get("returnTo"), user?.roles);
  const backHref = deanReturn || "/panelist/dashboard?tab=schedule";
  const [responding, setResponding] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [notice, setNotice] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["panelist-defense-session", sessionId, user?.id, user?.college?.id],
    queryFn: () =>
      apiClient.get<{ session: any }>(`/api/defense-sessions/${sessionId}?view=panelist`),
    enabled: Boolean(sessionId),
    refetchInterval: 15000,
  });
  const session = data?.session;
  const invitation = session?.invitations?.find(
    (item: any) => item.inviteeId === user?.id,
  );
  const pdfEvaluation =
    session?.packet?.evaluationMode === "PDF"
      ? session?.pdfEvaluations?.[0]
      : null;
  const evaluation = pdfEvaluation || session?.evaluations?.[0];
  const review = session?.manuscriptReviews?.[0];
  const recommendation = session?.recommendations?.[0];
  const packet = session?.packet;
  const meetingUrl = session?.meetingUrl || session?.defenseEvent?.meetingUrl;
  const venue = session?.venue || session?.defenseEvent?.venue;
  const isLive = session?.status === "LIVE";
  const timeline = useMemo(() => {
    if (!session) return [];
    return [
      invitation?.createdAt && {
        label: "Panel invitation issued",
        at: invitation.createdAt,
      },
      invitation?.respondedAt && {
        label: `Invitation ${readable(invitation.status).toLowerCase()}`,
        at: invitation.respondedAt,
      },
      packet?.publishedAt && {
        label: "Defense documents shared",
        at: packet.publishedAt,
      },
      review?.reviewedAt && {
        label: "Manuscript review completed",
        at: review.reviewedAt,
      },
      session.startedAt && {
        label: "Defense session started",
        at: session.startedAt,
      },
      (evaluation?.submittedAt || evaluation?.lockedAt) && {
        label:
          evaluation.status === "LOCKED"
            ? "Final evaluation locked"
            : "Evaluation submitted",
        at: evaluation.submittedAt || evaluation.lockedAt,
      },
      session.releasedAt && {
        label: "Official result released",
        at: session.releasedAt,
      },
    ]
      .filter(Boolean)
      .sort(
        (a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      ) as Array<{ label: string; at: string }>;
  }, [session, invitation, packet, review, evaluation]);

  const respond = async (response: "ACCEPTED" | "DECLINED") => {
    if (!invitation) return;
    const responseNote = response === "DECLINED" ? declineReason.trim() : "";
    if (response === "DECLINED" && !responseNote) return;
    setResponding(true);
    setNotice("");
    try {
      await apiClient.patch(
        `/api/defense-management/invitations/${invitation.id}/respond`,
        { response, responseNote, suggestedAvailability: [] },
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["panelist-defense-session", sessionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["panelist-dashboard-summary"],
        }),
        queryClient.invalidateQueries({ queryKey: ["universal-calendar"] }),
      ]);
      setNotice(
        response === "ACCEPTED"
          ? "Defense invitation accepted."
          : "Your unavailability was sent to the professor.",
      );
      setDeclineOpen(false);
      setDeclineReason("");
    } catch (reason: any) {
      setNotice(reason?.message || "Your response could not be saved.");
    } finally {
      setResponding(false);
    }
  };

  if (isLoading) return <DashboardSkeleton />;
  if (error || !session)
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Defense workspace unavailable"
        description={
          (error as any)?.message ||
          "This session was not found or is outside your assigned panel scope."
        }
        action={
          <Button
            variant="outline"
            onClick={() => router.push(backHref)}
          >
            {deanReturn ? "Back to Dean Defenses" : "Back to schedule"}
          </Button>
        }
      />
    );

  const packetReady = packet?.status === "PUBLISHED";
  const invitationAccepted = invitation?.status === "ACCEPTED";
  const reviewComplete = Boolean(review?.reviewedAt);
  const evaluationLocked = evaluation?.status === "LOCKED";
  const status = sessionStatus(session.status);
  const role = readable(invitation?.role, "Panelist");
  const members = (session.research.members || []).filter((member: any) =>
    ["LEADER", "MEMBER"].includes(member.projectRole),
  );
  const typeName = session.research.researchType?.name || session.defenseEvent?.defenseType;
  const eyebrow = [
    session.research.groupName || "Research group",
    typeName ? readable(typeName) : "Research defense",
    session.research.program?.code,
    session.defenseEvent?.code,
  ]
    .filter(Boolean)
    .join(" · ");
  const openEvaluation = () => router.push(`/panelist/dashboard?tab=evaluation&sessionId=${session.id}`);
  const openDocuments = () => router.push(`/panelist/dashboard?tab=documents&sessionId=${session.id}`);
  const evaluationStatus: { tone: StatusTone; label: string } = evaluationLocked
    ? { tone: "done", label: "Locked" }
    : evaluation
      ? { tone: "waiting", label: readable(evaluation.status) }
      : isLive
        ? { tone: "live", label: "Ready" }
        : { tone: "neutral", label: "Not started" };
  const canOpenEvaluation = invitationAccepted && (isLive || Boolean(evaluation) || session.packet?.evaluationMode === "PDF");
  // The one thing to do now, in order: answer the invitation, score a live defense, then finish the manuscript review.
  const needsResponse = Boolean(invitation && ["PENDING", "RECONFIRMATION_REQUIRED"].includes(invitation.status));
  const reviewOpen = packetReady && invitationAccepted && !reviewComplete;
  const focus: "respond" | "evaluate" | "review" | null = needsResponse
    ? "respond"
    : isLive && invitationAccepted && !evaluationLocked
      ? "evaluate"
      : reviewOpen
        ? "review"
        : null;
  const liveFor = isLive && session.startedAt ? durationSince(session.startedAt) : null;

  return (
    <div className="pw mx-auto w-full max-w-[1540px] p-1 sm:p-2 lg:p-3">
      <div className="pw-head">
      <Link
        href={backHref}
        className="pw-back"
        aria-label={deanReturn ? "Back to Dean defenses" : "Back to defense schedule"}
        title={deanReturn ? "Back to Dean defenses" : "Back to defense schedule"}
      >
        <i className="ti ti-arrow-left" aria-hidden="true" />
      </Link>
      <PageBand
        titleId="pw-title"
        guide="panelist-session"
        eyebrow={eyebrow}
        title={session.research.title}
        meta={
          <>
            <StatusDot tone={status.tone}>{status.label}</StatusDot>
            {" · "}
            {dateTime(session.scheduledStart)} · {attendanceMode(session)}
            {venue ? `, ${venue}` : meetingUrl ? ", online" : ""} · You’re {role.toLowerCase()}
          </>
        }
        actions={
          <>
            {meetingUrl && (
              <a href={meetingUrl} target="_blank" rel="noreferrer" className="pw-link-btn">
                <i className="ti ti-video" aria-hidden="true" />
                Join meeting
              </a>
            )}
            {packetReady && invitationAccepted && (
              <Button variant="secondary" size="sm" data-guide="panelist-open-packet" icon={<i className="ti ti-file-text" aria-hidden="true" />} onClick={openDocuments}>
                Documents
              </Button>
            )}
            {isLive && invitationAccepted && !evaluationLocked && focus !== "evaluate" && (
              <Button size="sm" data-guide="panelist-open-evaluation" icon={<i className="ti ti-clipboard-check" aria-hidden="true" />} onClick={openEvaluation}>
                Open live evaluation
              </Button>
            )}
          </>
        }
        footer={
          session.notes ? (
            <p className="pw-note">
              <i className="ti ti-note" aria-hidden="true" />
              <span>
                <strong>Facilitator note:</strong> {session.notes}
              </span>
            </p>
          ) : undefined
        }
      />
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-light)] px-4 py-3 text-sm font-semibold text-[var(--color-primary)]"
        >
          {notice}
        </div>
      )}
      {invitation &&
        ["PENDING", "RECONFIRMATION_REQUIRED"].includes(invitation.status) && (
          <SectionCard title={<span className="pw-kicker">Do this now · your response is required</span>} titleId="pw-response" className="pw-focus">
            <div className="au-card-body">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Accept the proposed schedule or privately tell the professor why you are unavailable.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={responding} onClick={() => setDeclineOpen((open) => !open)}>
                    Decline
                  </Button>
                  <Button size="sm" disabled={responding} onClick={() => respond("ACCEPTED")}>
                    Accept invitation
                  </Button>
                </div>
              </div>
              {declineOpen && (
                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  <label htmlFor="decline-reason" className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Private reason for the professor
                  </label>
                  <textarea
                    id="decline-reason"
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-base text-[var(--color-text-primary)]"
                    placeholder="Explain why you are unavailable"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeclineOpen(false);
                        setDeclineReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" disabled={responding || !declineReason.trim()} onClick={() => respond("DECLINED")}>
                      Decline and notify professor
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

      <ProgressStrip
        steps={[
          {
            label: "Invitation",
            detail: invitationAccepted ? "Accepted" : needsResponse ? "Respond now" : readable(invitation?.status, "Not sent"),
            state: invitationAccepted ? "done" : needsResponse ? "focus" : "current",
          },
          {
            label: "Documents",
            detail: packetReady ? `Published ${shortDateTime(packet.publishedAt)}` : "Not shared yet",
            state: packetReady ? "done" : "pending",
          },
          {
            label: "Manuscript review",
            detail: reviewComplete ? `Completed ${shortDateTime(review.reviewedAt)}` : focus === "review" ? "Do this next" : reviewOpen ? "Not finished" : "Waiting for documents",
            state: reviewComplete ? "done" : focus === "review" ? "focus" : reviewOpen ? "todo" : "pending",
          },
          {
            label: "Evaluation",
            detail: evaluationLocked ? `Locked ${shortDateTime(evaluation.lockedAt)}` : focus === "evaluate" ? "Do this now" : evaluation ? readable(evaluation.status) : "Unlocks when the defense starts",
            state: evaluationLocked ? "done" : focus === "evaluate" ? "focus" : evaluation ? "current" : "pending",
          },
        ]}
      />

      <div className="pw-pair">
        {focus === "evaluate" ? (
        <SectionCard
          title={<span className="pw-kicker">Do this now{liveFor ? ` · live for ${liveFor}` : ""}</span>}
          titleId="pw-evaluation"
          className="pw-focus"
        >
          <div className="pw-focus-body">
            <h3>{evaluation ? "Finish scoring this defense" : "Score this defense"}</h3>
            <p>
              {session.packet?.evaluationMode === "PDF"
                ? "Mark your department’s original form directly. Submit it before the session ends."
                : "Save a draft anytime. Submit the final rubric before the session ends."}
            </p>
          </div>
          <div className="pw-focus-actions">
            <Button size="sm" data-guide="panelist-open-evaluation" icon={<i className="ti ti-clipboard-check" aria-hidden="true" />} onClick={openEvaluation}>
              {evaluation ? "Continue scoring" : "Start scoring"}
            </Button>
            {evaluation && <span className="au-row-meta">Draft saved · {readable(evaluation.status).toLowerCase()}</span>}
          </div>
          <div className="pw-foot">
            {session.releasedAt ? (
              <>
                <i className="ti ti-rosette-discount-check pw-ok" aria-hidden="true" />
                <span>
                  <strong>Official result: {readable(session.decision)}</strong> · released {shortDateTime(session.releasedAt)}
                </span>
              </>
            ) : (
              <>
                <i className="ti ti-lock" aria-hidden="true" />
                <span>Official result not released yet. The professor or facilitator releases it.</span>
              </>
            )}
          </div>
        </SectionCard>
        ) : (
        <SectionCard title="Your evaluation" titleId="pw-evaluation" action={<StatusDot tone={evaluationStatus.tone}>{evaluationStatus.label}</StatusDot>}>
          <ListRow
            leading={<RowIcon icon={session.packet?.evaluationMode === "PDF" ? "ti-file-pencil" : "ti-clipboard-check"} />}
            title={
              session.packet?.evaluationMode === "PDF"
                ? pdfEvaluation?.status === "LOCKED"
                  ? "PDF evaluation submitted and locked"
                  : pdfEvaluation
                    ? "Your private PDF evaluation draft"
                    : "PDF evaluation not started"
                : evaluation
                  ? `Score ${evaluation.totalScore ?? "draft"}${evaluation.template?.totalScore ? ` / ${Number(evaluation.template.totalScore)}` : ""}`
                  : isLive
                    ? "Score this defense now"
                    : "Evaluation not started"
            }
            meta={
              session.packet?.evaluationMode === "PDF"
                ? "Mark your department’s original form directly. Visual ratings aren’t calculated grades."
                : evaluation
                  ? `Recommendation: ${readable(evaluation.recommendation)}${evaluation.status === "SUBMITTED" ? " · submitted, not yet locked" : evaluationLocked ? " · final and locked" : ""}`
                  : isLive
                    ? "Save a draft or submit the final rubric while the defense is live."
                    : "Scoring unlocks when the professor starts this defense."
            }
            end={
              canOpenEvaluation ? (
                <Button size="sm" variant="secondary" data-guide="panelist-open-evaluation" onClick={openEvaluation}>
                  Open
                </Button>
              ) : undefined
            }
          />
          <div className="pw-foot">
            {session.releasedAt ? (
              <>
                <i className="ti ti-rosette-discount-check pw-ok" aria-hidden="true" />
                <span>
                  <strong>Official result: {readable(session.decision)}</strong> · released {shortDateTime(session.releasedAt)}
                </span>
              </>
            ) : (
              <>
                <i className="ti ti-lock" aria-hidden="true" />
                <span>Official result not released yet. The professor or facilitator releases it.</span>
              </>
            )}
          </div>
        </SectionCard>
        )}

        <SectionCard
          title="Defense documents"
          titleId="pw-documents"
          className={focus === "review" ? "pw-focus" : reviewOpen ? "pw-nudge" : undefined}
          action={
            reviewOpen ? (
              <StatusDot tone="waiting">Review not finished</StatusDot>
            ) : packet ? (
              <StatusDot tone={packetReady ? "done" : "waiting"}>{readable(packet.status)}</StatusDot>
            ) : (
              <StatusDot tone="neutral">Not shared</StatusDot>
            )
          }
        >
          {packetReady && invitationAccepted ? (
            <>
              <ListRow
                leading={<RowIcon icon="ti-file-text" />}
                title={`${packet.manuscriptVersion?.document?.title || "Published manuscript"}${packet.manuscriptVersion?.versionNumber ? ` · v${packet.manuscriptVersion.versionNumber}` : ""}`}
                titleHint={packet.manuscriptVersion?.document?.title}
                meta={[packet.manuscriptVersion?.fileName || "File name unavailable", packet.manuscriptVersion?.milestone?.name].filter(Boolean).join(" · ")}
                end={
                  <Button size="sm" variant={focus === "review" ? "primary" : "secondary"} data-guide="panelist-open-packet" onClick={openDocuments}>
                    {reviewOpen ? (review ? "Continue review" : "Start review") : "Open"}
                  </Button>
                }
              />
              <div className="pw-foot">
                <StatusDot tone={packet.manuscriptVersion?.isImmutable ? "done" : "waiting"}>
                  {packet.manuscriptVersion?.isImmutable ? "Locked version" : "Lock not verified"}
                </StatusDot>
                {packet.publishedAt && <span>Published {shortDateTime(packet.publishedAt)}</span>}
                {review && reviewComplete && <StatusDot tone={reviewComplete ? "done" : "waiting"}>{reviewComplete ? "Review complete" : "Review in progress"}</StatusDot>}
                {recommendation && <StatusDot tone="brand">Recommendation {readable(recommendation.status).toLowerCase()}</StatusDot>}
              </div>
            </>
          ) : (
            <EmptyNote
              icon="ti-file-text"
              title={packetReady ? "Accept to open the documents" : "Documents not shared yet"}
              text={
                packetReady
                  ? "The documents are ready. Accept your panel invitation to view them."
                  : "The professor publishes the approved manuscript before panel review opens."
              }
            />
          )}
        </SectionCard>
      </div>

      <div className="pw-pair">
        <SectionCard title="Research group" titleId="pw-group" count={members.length}>
          {members.length ? (
            <ul className="au-list">
              {members.map((member: any) => (
                <li key={member.id}>
                  <ListRow
                    leading={<span className="pw-avatar" aria-hidden="true">{initials(member.user)}</span>}
                    title={fullName(member.user)}
                    meta={member.user?.email}
                    end={<span className="pw-tag" data-role={member.projectRole}>{readable(member.projectRole)}</span>}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote icon="ti-users" title="No researchers listed" text="Group members appear here once they're recorded." />
          )}
          <div className="pw-foot">
            <span>
              Stage: <strong>{session.research.workflowInstance?.currentStage?.name || "Not recorded"}</strong>
            </span>
            <span>
              Academic year: <strong>{session.research.academicYear?.name || "Not recorded"}</strong>
            </span>
          </div>
        </SectionCard>

        <SectionCard title="Activity" titleId="pw-activity" count={timeline.length || undefined}>
          {timeline.length ? (
            <ol className="pw-timeline">
              {timeline.map((item) => (
                <li key={`${item.label}:${item.at}`}>
                  <strong>{item.label}</strong>
                  <time dateTime={item.at}>{shortDateTime(item.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyNote icon="ti-history" title="No activity yet" text="Invitations, shared documents and evaluations appear here." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
