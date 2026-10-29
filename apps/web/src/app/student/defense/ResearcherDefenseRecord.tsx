import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  defenseResultLabels,
  type DefenseResult,
} from "@research-management/validations";
import { apiClient } from "@/lib/api-client";
import { DefenseBadgeCard } from "@/components/defense/DefenseBadgeCard";
import { SharedManuscriptFeedback } from "@/components/documents/SharedManuscriptFeedback";

export const readable = (value?: string | null) =>
  value
    ? value
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^\w/, (letter) => letter.toUpperCase())
    : "Not available";

// Read-only researcher presentation. Scores and recommendation labels are mapped
// exactly as in ConsolidatedEvaluations; no facilitator actions are included.
export function ResearcherEvaluations({ report }: { report: any }) {
  const fmt = (n: number | null | undefined) =>
    n == null ? "Pending" : n.toFixed(2);
  return (
    <>
      <section className="rdf-section" aria-labelledby="rdf-evaluations">
        <div className="rdf-section-heading">
          <h2 id="rdf-evaluations">Consolidated evaluations</h2>
          <p>
            {report.submitted} / {report.required} required evaluations
            submitted ·{" "}
            {report.final ? "Final averages" : "Provisional averages"}
          </p>
        </div>
        <p className="rdf-caption">
          Equal weighting across submitted required panelists. Missing
          submissions are excluded, never counted as zero.
        </p>
        <div
          className="rdf-table-scroll"
          role="region"
          aria-label="Consolidated evaluation scores, horizontally scrollable"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Evaluation</th>
                {report.panels.map((p: any) => (
                  <th scope="col" key={p.userId}>
                    {p.name}
                    <span>
                      {p.required ? "Required" : "Optional · excluded"}
                    </span>
                  </th>
                ))}
                <th scope="col" className="rdf-average">
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ...report.researchers,
                {
                  userId: "manuscript",
                  name: "Group manuscript",
                  ...report.manuscript,
                },
              ].map((r: any) => (
                <tr key={r.userId}>
                  <th scope="row">
                    {r.name}
                    <span>Out of {r.maximum.toFixed(2)}</span>
                  </th>
                  {report.panels.map((p: any) => (
                    <td key={p.userId}>
                      {fmt(
                        r.userId === "manuscript"
                          ? p.totals?.manuscript.score
                          : p.totals?.researchers.find(
                              (t: any) => t.userId === r.userId,
                            )?.score,
                      )}
                    </td>
                  ))}
                  <td className="rdf-average">{fmt(r.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section
        className="rdf-section rdf-recommendations"
        aria-labelledby="rdf-recommendations"
      >
        <h2 id="rdf-recommendations">Recommended defense results</h2>
        {report.panels.map((p: any) => (
          <details key={p.userId}>
            <summary>
              <span className="rdf-panel-name">{p.name}</span>
              <span className="rdf-recommendation-value">
                {" "}
                ·{" "}
                {p.submitted
                  ? defenseResultLabels[
                      p.answers.recommendation as DefenseResult
                    ]
                  : "Pending submission"}
                {p.submitted ? " · Locked" : ""}
              </span>
            </summary>
            {p.submitted && (
              <div className="rdf-feedback-body">
                <p>{p.answers.feedback || "No additional feedback."}</p>
              </div>
            )}
          </details>
        ))}
      </section>
    </>
  );
}

export function ResearcherOfficialResult({
  session,
  revisionClearance,
}: {
  session: any;
  revisionClearance?: any;
}) {
  return (
    <section
      className="rdf-result"
      aria-labelledby="rdf-result"
      data-decision={session.releasedAt ? session.decision : undefined}
    >
      <h2 id="rdf-result">Official defense result</h2>
      {session.releasedAt ? (
        <>
          <p className="rdf-eyebrow">Released result</p>
          <p className="rdf-decision">
            {defenseResultLabels[session.decision as DefenseResult] ||
              readable(session.decision)}
          </p>
          <p className="rdf-secondary">
            Released {new Date(session.releasedAt).toLocaleString()}
          </p>
          <p className="rdf-caption">
            Panelist recommendations and averages do not automatically determine
            the official decision.
          </p>
          {revisionClearance && (
            <p className="rdf-secondary">
              Revisions cleared on{" "}
              {new Date(revisionClearance.clearedAt).toLocaleDateString()}. The
              original defense decision is retained.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="rdf-unreleased">Result not released</p>
          <p className="rdf-secondary">
            Panel evaluations remain private until the professor or coordinator
            releases the official decision.
          </p>
        </>
      )}
    </section>
  );
}

export function ResearcherDefenseSession({ session }: { session: any }) {
  const invitations = (session.invitations || []).filter(
    (invitation: any) => invitation.status !== "REMOVED",
  );
  const confirmed = invitations.filter(
    (invitation: any) => invitation.status === "ACCEPTED",
  ).length;
  const researchers = (session.research?.members || []).filter((member: any) =>
    ["LEADER", "MEMBER"].includes(member.projectRole),
  );
  const adviser =
    (session.research?.members || []).find(
      (member: any) => member.projectRole === "ADVISER",
    )?.user || session.research?.adviserRequests?.[0]?.adviser;
  const event = session.defenseEvent;
  return (
    <section className="rdf-section" aria-labelledby="rdf-session">
      <h2 id="rdf-session">Defense session</h2>
      <p className="rdf-caption">
        This is the official slot created from{" "}
        {event?.code || "the professor defense session"}.
      </p>
      <div className="rdf-session-grid">
        <div>
          <h3>Schedule and venue</h3>
          <dl className="rdf-facts">
            <div>
              <dt>Defense type</dt>
              <dd>{readable(event?.defenseType)}</dd>
            </div>
            <div>
              <dt>Queue</dt>
              <dd>
                <span
                  className="rdf-status-text"
                  data-status={session.queueStatus}
                >
                  {session.queuePosition
                    ? `Position ${session.queuePosition} · ${readable(session.queueStatus)}`
                    : readable(session.queueStatus)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Starts</dt>
              <dd>
                {session.scheduledStart
                  ? new Date(session.scheduledStart).toLocaleString()
                  : "To be announced"}
              </dd>
            </div>
            <div>
              <dt>Ends</dt>
              <dd>
                {session.scheduledEnd
                  ? new Date(session.scheduledEnd).toLocaleString()
                  : "To be announced"}
              </dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>{session.venue || event?.venue || "To be announced"}</dd>
            </div>
            <div>
              <dt>Research group</dt>
              <dd>
                {researchers
                  .map(
                    (member: any) =>
                      `${member.user.firstName} ${member.user.lastName}`,
                  )
                  .join(", ")}
              </dd>
            </div>
          </dl>
          {(session.meetingUrl || event?.meetingUrl) && (
            <a
              href={session.meetingUrl || event.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="rdf-action rdf-meeting"
            >
              <i className="ti ti-video" aria-hidden="true" />
              Open defense meeting
            </a>
          )}
        </div>
        <div className="rdf-panel">
          <div className="rdf-section-heading">
            <h3>Defense panel</h3>
            <p>
              {confirmed} of {invitations.length} confirmed
            </p>
          </div>
          {adviser && (
            <p className="rdf-secondary rdf-adviser">
              Adviser:{" "}
              <strong>
                {adviser.firstName} {adviser.lastName}
              </strong>
            </p>
          )}
          <div>
            {invitations.map((invitation: any) => (
              <div key={invitation.id} className="rdf-panel-row">
                <div>
                  <p className="rdf-panel-name">
                    {invitation.invitee.firstName} {invitation.invitee.lastName}
                  </p>
                  <p className="rdf-secondary">{readable(invitation.role)}</p>
                </div>
                <span
                  className="rdf-status-text"
                  data-status={invitation.status}
                >
                  {readable(invitation.status)}
                </span>
              </div>
            ))}
            {!invitations.length && (
              <p className="rdf-secondary rdf-empty-line">
                Panel assignments have not been published.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ResearcherDefenseDocuments({
  packet,
  packetHistoryData,
  documents,
  projectHref,
}: {
  packet: any;
  packetHistoryData: any;
  documents: any[];
  projectHref: (path: string) => string;
}) {
  return (
    <section
      className="rdf-section rdf-documents"
      aria-labelledby="rdf-manuscript"
    >
      <h2 id="rdf-manuscript">Published defense manuscript</h2>
      <p className="rdf-caption">
        The exact immutable version published in this defense packet.
      </p>
      {packet?.manuscriptVersion ? (
        <div className="rdf-manuscript-row">
          <div className="rdf-document-title-row">
            <p className="rdf-file-title">
              {packet.manuscriptVersion.document.title}
            </p>
            <Link
              to={projectHref(
                `/student/documents?documentId=${packet.manuscriptVersion.document.id}&versionId=${packet.manuscriptVersion.id}`,
              )}
              className="rdf-action"
            >
              Open version
            </Link>
          </div>
          <p className="rdf-secondary">
            Version {packet.manuscriptVersion.versionNumber} ·{" "}
            {readable(packet.manuscriptVersion.manuscriptStatus)} ·{" "}
            {packet.manuscriptVersion.isImmutable
              ? "Frozen submission"
              : "Working version"}
          </p>
          <p className="rdf-secondary">
            Published{" "}
            {packet.publishedAt
              ? new Date(packet.publishedAt).toLocaleString()
              : "date unavailable"}
            {packetHistoryData?.publications?.length
              ? ` · ${packetHistoryData.publications.length} publication record${packetHistoryData.publications.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
      ) : (
        <p className="rdf-secondary rdf-empty-line">
          No published defense manuscript packet is available for this session
          yet.
        </p>
      )}
      <div className="rdf-related">
        <div className="rdf-section-heading">
          <h3>Related project documents</h3>
          <Link
            to={projectHref("/student/documents")}
            className="rdf-text-action"
          >
            Open all
          </Link>
        </div>
        <div>
          {documents
            .filter(
              (document: any) =>
                document.id !== packet?.manuscriptVersion?.document.id,
            )
            .slice(0, 3)
            .map((document: any) => (
              <div key={document.id} className="rdf-document-row">
                <div>
                  <p className="rdf-file-title">{document.title}</p>
                  <p className="rdf-secondary">
                    <span className="rdf-identifier">
                      {readable(document.documentType)}
                    </span>{" "}
                    · Version {document.currentVersion}
                  </p>
                </div>
                <i className="ti ti-file-text" aria-hidden="true" />
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

export function ResearcherDefenseRecord({
  selectedSession,
  sessions,
  packet,
  packetHistoryData,
  documents,
  projectHref,
}: {
  selectedSession: any;
  sessions: any[];
  packet: any;
  packetHistoryData: any;
  documents: any[];
  projectHref: (path: string) => string;
}) {
  const showEvaluations = Boolean(
    selectedSession?.packet?.evaluationMode === "STRUCTURED" &&
    selectedSession?.releasedAt,
  );
  // Same key, endpoint, release gate and researcher polling policy as the
  // original student ConsolidatedEvaluations instance. No additional sources.
  const query = useQuery({
    queryKey: ["structured-results", selectedSession?.id],
    queryFn: () =>
      apiClient.get<any>(
        `/api/defense-sessions/${selectedSession.id}/structured-results`,
      ),
    enabled: showEvaluations,
    refetchInterval: false,
  });
  return (
    <>
      {selectedSession && (
        <ResearcherOfficialResult
          session={selectedSession}
          revisionClearance={
            showEvaluations && !query.isPending && !query.isError
              ? query.data?.revisionClearance
              : undefined
          }
        />
      )}
      {sessions.some((session: any) => session.badge) && (
        <section
          className="rdf-section rdf-achievements"
          aria-label="Defense achievement badges"
        >
          <h2>Your group’s defense badges</h2>
          {sessions
            .filter((session: any) => session.badge)
            .map((session: any) => (
              <DefenseBadgeCard key={session.id} badge={session.badge} />
            ))}
        </section>
      )}
      {showEvaluations &&
        (query.isPending ? (
          <p className="rdf-section">Loading consolidated evaluations…</p>
        ) : query.isError ? (
          <p className="rdf-section" role="alert">
            {query.error.message}
          </p>
        ) : (
          <ResearcherEvaluations report={query.data.report} />
        ))}
      {selectedSession && (
        <>
          <section
            className="rdf-section rdf-shared-feedback"
            aria-labelledby="rdf-manuscript-review"
          >
            <h2 id="rdf-manuscript-review">Manuscript review</h2>
            <SharedManuscriptFeedback sessionId={selectedSession.id} />
          </section>
          <ResearcherDefenseSession session={selectedSession} />
          <ResearcherDefenseDocuments
            packet={packet}
            packetHistoryData={packetHistoryData}
            documents={documents}
            projectHref={projectHref}
          />
        </>
      )}
      {sessions.length > 1 && (
        <section
          className="rdf-section rdf-history"
          aria-labelledby="rdf-history"
        >
          <h2 id="rdf-history">Defense session history</h2>
          <div>
            {sessions.map((session: any) => (
              <Link
                key={session.id}
                to={projectHref(`/student/defense/${session.id}`)}
                aria-current={
                  session.id === selectedSession?.id ? "page" : undefined
                }
              >
                <div>
                  <p className="rdf-file-title">
                    {session.defenseEvent?.code ||
                      `Session ${session.id.slice(0, 8)}`}
                  </p>
                  <p className="rdf-secondary">
                    {session.scheduledStart
                      ? new Date(session.scheduledStart).toLocaleString()
                      : "Schedule unavailable"}
                  </p>
                </div>
                <span className="rdf-status-text" data-status={session.status}>
                  {readable(session.status)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
