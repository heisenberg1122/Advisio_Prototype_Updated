"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPin,
  MonitorUp,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { Tag, type ExtendedTagVariant } from "@/components/ui/Tag";

const TZ = "Asia/Manila";
const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TZ,
      }).format(new Date(value))
    : "Not scheduled";
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
const statusVariant = (status?: string | null): ExtendedTagVariant => {
  if (
    [
      "ACCEPTED",
      "SCHEDULED",
      "LIVE",
      "LOCKED",
      "PUBLISHED",
      "COMPLETED",
    ].includes(status || "")
  )
    return "success";
  if (
    ["DECLINED", "CANCELLED", "NEEDS_RESCHEDULING", "REJECTED"].includes(
      status || "",
    )
  )
    return "danger";
  if (
    [
      "PENDING",
      "PENDING_ACKNOWLEDGEMENT",
      "RECONFIRMATION_REQUIRED",
      "DRAFT",
    ].includes(status || "")
  )
    return "warning";
  return "info";
};

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

function ReadinessItem({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700"}`}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <CalendarClock className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm text-[var(--color-text-primary)]">
          {label}
        </strong>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-secondary)]">
          {detail}
        </span>
      </span>
    </div>
  );
}

export default function PanelistDefenseWorkspacePage() {
  const { sessionId = "" } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [responding, setResponding] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [notice, setNotice] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["panelist-defense-session", sessionId],
    queryFn: () =>
      apiClient.get<{ session: any }>(`/api/defense-sessions/${sessionId}`),
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
        label: "Defense packet published",
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
            onClick={() => router.push("/panelist/dashboard?tab=schedule")}
          >
            Back to schedule
          </Button>
        }
      />
    );

  const packetReady = packet?.status === "PUBLISHED";
  const invitationAccepted = invitation?.status === "ACCEPTED";
  const reviewComplete = Boolean(review?.reviewedAt);
  const evaluationLocked = evaluation?.status === "LOCKED";

  return (
    <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-5 p-1 sm:p-2 lg:p-3">
      <Link
        href="/panelist/dashboard?tab=schedule"
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to defense schedule
      </Link>

      <section className="college-hero-surface overflow-hidden rounded-2xl border border-[var(--color-border)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag variant={statusVariant(session.status)} dot>
                {readable(session.status)}
              </Tag>
              <Tag variant="outline">{attendanceMode(session)}</Tag>
              <Tag variant={statusVariant(invitation?.status)}>
                {readable(invitation?.status, "Invitation unavailable")}
              </Tag>
            </div>
            <p className="mt-4 text-sm font-bold uppercase tracking-[.16em] text-[var(--color-primary)]">
              {session.research.groupName || "Research group"}
            </p>
            <h1 className="mt-1 max-w-4xl text-2xl font-bold leading-tight text-[var(--color-text-primary)] sm:text-3xl">
              {session.research.title}
            </h1>
            <p className="mt-2 text-base text-[var(--color-text-secondary)]">
              {session.research.researchType?.name ||
              session.defenseEvent?.defenseType
                ? readable(
                    session.research.researchType?.name ||
                      session.defenseEvent?.defenseType,
                  )
                : "Research defense"}{" "}
              · {session.research.program?.code || "Program not recorded"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {meetingUrl && (
              <a
                href={meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
              >
                <MonitorUp className="h-4 w-4" />
                Join meeting
              </a>
            )}
            {packetReady && invitationAccepted && (
              <Button
                variant="secondary"
                icon={<FileText className="h-4 w-4" />}
                onClick={() =>
                  router.push(
                    `/panelist/dashboard?tab=documents&sessionId=${session.id}`,
                  )
                }
              >
                Open defense packet
              </Button>
            )}
            {isLive && invitationAccepted && !evaluationLocked && (
              <Button
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() =>
                  router.push(
                    `/panelist/dashboard?tab=evaluation&sessionId=${session.id}`,
                  )
                }
              >
                Open live evaluation
              </Button>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Schedule
            </span>
            <p className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
              {dateTime(session.scheduledStart)}
            </p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Venue
            </span>
            <p className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
              {venue || (meetingUrl ? "Online defense" : "Not assigned")}
            </p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Your role
            </span>
            <p className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
              {readable(invitation?.role)}
            </p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Academic year
            </span>
            <p className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
              {session.research.academicYear?.name || "Not recorded"}
            </p>
          </div>
        </div>
      </section>

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
          <Card className="border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-[var(--color-text-primary)]">
                  Your response is required
                </h2>
                <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                  Accept the proposed schedule or privately tell the professor
                  why you are unavailable.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={responding}
                  onClick={() => setDeclineOpen((open) => !open)}
                >
                  Decline
                </Button>
                <Button
                  disabled={responding}
                  onClick={() => respond("ACCEPTED")}
                >
                  Accept invitation
                </Button>
              </div>
            </div>
            {declineOpen && (
              <div className="mt-4 border-t border-amber-200 pt-4">
                <label
                  htmlFor="decline-reason"
                  className="text-sm font-semibold text-[var(--color-text-primary)]"
                >
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
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={responding || !declineReason.trim()}
                    onClick={() => respond("DECLINED")}
                  >
                    Decline and notify professor
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReadinessItem
          done={invitationAccepted}
          label="Invitation"
          detail={
            invitationAccepted
              ? "Accepted panel assignment"
              : readable(invitation?.status)
          }
        />
        <ReadinessItem
          done={packetReady}
          label="Defense packet"
          detail={
            packetReady
              ? `Published ${dateTime(packet.publishedAt)}`
              : "Not yet published by the professor"
          }
        />
        <ReadinessItem
          done={reviewComplete}
          label="Manuscript review"
          detail={
            reviewComplete
              ? `Completed ${dateTime(review.reviewedAt)}`
              : packetReady
                ? "Available for your review"
                : "Waiting for a published packet"
          }
        />
        <ReadinessItem
          done={evaluationLocked}
          label="Evaluation"
          detail={
            evaluationLocked
              ? `Final and locked ${dateTime(evaluation.lockedAt)}`
              : evaluation
                ? `${readable(evaluation.status)} evaluation`
                : isLive
                  ? "Ready during this live session"
                  : "Unlocks when the defense starts"
          }
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-5 sm:p-6">
          <CardHeader>
            <div>
              <CardTitle icon={FileCheck2}>Defense packet and review</CardTitle>
              <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                The immutable manuscript and your project-specific panel review.
              </p>
            </div>
            {packet && (
              <Tag variant={statusVariant(packet.status)}>
                {readable(packet.status)}
              </Tag>
            )}
          </CardHeader>
          {packetReady && invitationAccepted ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-[var(--color-surface-subtle)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-[var(--color-text-primary)]">
                    {packet.manuscriptVersion?.document?.title ||
                      "Published manuscript"}
                  </strong>
                  <span className="text-xs font-semibold text-[var(--color-primary)]">
                    Version {packet.manuscriptVersion?.versionNumber}
                  </span>
                </div>
                <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                  {packet.manuscriptVersion?.fileName ||
                    "File name unavailable"}
                  {packet.manuscriptVersion?.milestone?.name
                    ? ` · ${packet.manuscriptVersion.milestone.name}`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Tag
                    variant={
                      packet.manuscriptVersion?.isImmutable
                        ? "success"
                        : "warning"
                    }
                    icon={<LockKeyhole className="h-3 w-3" />}
                  >
                    {packet.manuscriptVersion?.isImmutable
                      ? "Immutable defense version"
                      : "Immutability not verified"}
                  </Tag>
                  {review && (
                    <Tag variant={reviewComplete ? "success" : "warning"}>
                      {reviewComplete
                        ? "Review complete"
                        : "Review in progress"}
                    </Tag>
                  )}
                  {recommendation && (
                    <Tag variant={statusVariant(recommendation.status)}>
                      Recommendation {readable(recommendation.status)}
                    </Tag>
                  )}
                </div>
              </div>
              <Button
                onClick={() =>
                  router.push(
                    `/panelist/dashboard?tab=documents&sessionId=${session.id}`,
                  )
                }
                icon={<ExternalLink className="h-4 w-4" />}
              >
                Open packet workspace
              </Button>
            </div>
          ) : (
            <EmptyState
              size="sm"
              icon={FileText}
              title={
                packetReady
                  ? "Accept to open the defense packet"
                  : "Defense packet not published"
              }
              description={
                packetReady
                  ? "The packet is ready, but its contents remain restricted until you accept this panel assignment."
                  : "The professor must publish an approved immutable manuscript before panel review becomes available."
              }
            />
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader>
            <CardTitle icon={UsersRound}>Research group</CardTitle>
            <Tag variant="neutral">
              {session.research.members?.filter((member: any) =>
                ["LEADER", "MEMBER"].includes(member.projectRole),
              ).length || 0}{" "}
              researchers
            </Tag>
          </CardHeader>
          <div className="space-y-2">
            {session.research.members
              ?.filter((member: any) =>
                ["LEADER", "MEMBER"].includes(member.projectRole),
              )
              .map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-subtle)] px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {fullName(member.user)}
                    </p>
                    <p className="truncate text-sm text-[var(--color-text-muted)]">
                      {member.user.email}
                    </p>
                  </div>
                  <Tag
                    size="xs"
                    variant={
                      member.projectRole === "LEADER" ? "primary" : "neutral"
                    }
                  >
                    {readable(member.projectRole)}
                  </Tag>
                </div>
              ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <CardHeader>
            <CardTitle icon={ClipboardCheck}>
              Evaluation and authorized result
            </CardTitle>
            {evaluation && (
              <Tag variant={statusVariant(evaluation.status)}>
                {readable(evaluation.status)}
              </Tag>
            )}
          </CardHeader>
          {session.packet?.evaluationMode === "PDF" ? (
            <div className="rounded-xl bg-[var(--color-surface-subtle)] p-4">
              <p className="text-base font-semibold">
                {pdfEvaluation?.status === "LOCKED"
                  ? "PDF evaluation submitted and locked"
                  : pdfEvaluation
                    ? "Your private PDF evaluation draft"
                    : "Your PDF evaluation has not been started"}
              </p>
              <p className="mt-2 text-base text-[var(--color-text-secondary)]">
                Mark your department’s original form directly. Visual ratings
                are not calculated grades.
              </p>
              <Button
                className="mt-3"
                onClick={() =>
                  router.push(
                    `/panelist/dashboard?tab=evaluation&sessionId=${session.id}`,
                  )
                }
              >
                Open PDF evaluation
              </Button>
            </div>
          ) : evaluation ? (
            <div className="rounded-xl bg-[var(--color-surface-subtle)] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Score
                  </span>
                  <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
                    {evaluation.totalScore ?? "Draft"}
                    {evaluation.template?.totalScore
                      ? ` / ${Number(evaluation.template.totalScore)}`
                      : ""}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Recommendation
                  </span>
                  <p className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
                    {readable(evaluation.recommendation)}
                  </p>
                </div>
              </div>
              {evaluation.status === "SUBMITTED" && (
                <p className="mt-3 text-base text-amber-700 dark:text-amber-300">
                  Submitted, but not locked as a final immutable evaluation.
                </p>
              )}
              {evaluation.status === "LOCKED" && (
                <p className="mt-3 flex items-center gap-2 text-base font-semibold text-emerald-700 dark:text-emerald-300">
                  <LockKeyhole className="h-4 w-4" />
                  Final submission is immutable.
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              size="sm"
              icon={ClipboardCheck}
              title={isLive ? "Evaluation is ready" : "Evaluation not started"}
              description={
                isLive
                  ? "Open the live evaluation workspace to save a draft or submit the final rubric."
                  : "Scoring unlocks only when the professor starts this assigned defense."
              }
            />
          )}
          {session.releasedAt ? (
            <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 dark:bg-emerald-500/10">
              <p className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Official result released
              </p>
              <p className="mt-1 text-base font-bold text-[var(--color-text-primary)]">
                {readable(session.decision)}
              </p>
              <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                Released {dateTime(session.releasedAt)}
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-3 text-base text-[var(--color-text-secondary)]">
              No official result has been released. Release authority remains
              with the professor or authorized facilitator.
            </p>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader>
            <CardTitle icon={MapPin}>Session details and activity</CardTitle>
            <Tag variant="outline">
              {session.defenseEvent?.code || "Standalone session"}
            </Tag>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--color-surface-subtle)] p-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Delivery
              </span>
              <p className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
                {attendanceMode(session)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-surface-subtle)] p-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Current stage
              </span>
              <p className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
                {session.research.workflowInstance?.currentStage?.name ||
                  "Not recorded"}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {timeline.length ? (
              timeline.map((item) => (
                <div key={`${item.label}:${item.at}`} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                  <div>
                    <p className="text-base font-semibold text-[var(--color-text-primary)]">
                      {item.label}
                    </p>
                    <time className="text-xs text-[var(--color-text-muted)]">
                      {dateTime(item.at)}
                    </time>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-base text-[var(--color-text-secondary)]">
                No session activity has been recorded yet.
              </p>
            )}
          </div>
          {session.notes && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Facilitator notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-base leading-5 text-[var(--color-text-secondary)]">
                {session.notes}
              </p>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
