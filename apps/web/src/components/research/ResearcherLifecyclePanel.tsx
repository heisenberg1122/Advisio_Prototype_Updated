import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useResearcherLifecycle } from "@/hooks/use-researcher-lifecycle";
import { useAsyncAction } from "@/hooks/use-async-action";
import {
  createResearchTeam,
  startTeamResearch,
} from "@/lib/researcher-lifecycle-actions";
import {
  researcherLifecycleMessage,
  researchStartError,
} from "@/lib/researcher-lifecycle";
import { TeamEmailInvitation } from "@/components/workflow/TeamEmailInvitation";
import { Modal } from "@/components/ui/Modal";

const card =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-[var(--college-on-primary)] disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-50";
const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-base text-[var(--color-text-primary)]";

export function ResearcherLifecyclePanel() {
  const lifecycle = useResearcherLifecycle();
  return <ResearcherLifecycleView lifecycle={lifecycle} />;
}

export function ResearcherLifecycleView({
  lifecycle,
}: {
  lifecycle: ReturnType<typeof useResearcherLifecycle>;
}) {
  const client = useQueryClient();
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"GROUP" | "SOLO">("GROUP");
  const [accessMode, setAccessMode] = useState<"INVITE_ONLY" | "PUBLIC_OPEN">(
    "INVITE_ONLY",
  );
  const createAction = useAsyncAction();
  const startAction = useAsyncAction();
  const {
    state,
    cohort,
    team,
    project,
    activeCohorts,
    teamChoices,
    caseChoices,
  } = lifecycle;
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cohort || state !== "COHORT_NO_TEAM" || !name.trim()) return;
    await createAction
      .run(
        async () => {
          const workspace = await createResearchTeam(client, {
            cohortId: cohort.id,
            name: name.trim(),
            participationMode: mode,
            accessMode: mode === "GROUP" ? accessMode : "INVITE_ONLY",
          });
          lifecycle.chooseContext(cohort.id, workspace.id);
          setCreatingTeam(false);
          setName("");
        },
        {
          successMessage:
            "Research team created. Your leader can start research when the team is ready.",
          errorMessage: researchStartError,
        },
      )
      .catch(() => undefined);
  };
  const start = async () => {
    if (!lifecycle.canStart || !team || !confirmStart) return;
    await startAction
      .run(
        async () => {
          const result = await startTeamResearch(client, team.id);
          lifecycle.selectCase(result.project.id);
          setConfirmStart(false);
        },
        {
          successMessage: "Research process started.",
          errorMessage: researchStartError,
        },
      )
      .catch(() => undefined);
  };
  if (lifecycle.loading)
    return (
      <section className={card} role="status">
        Loading your research cohort and team…
      </section>
    );
  if (lifecycle.error)
    return (
      <section className={card} role="alert">
        <p>Your research context could not be loaded.</p>
        <button
          className={`${secondary} mt-3`}
          onClick={() => lifecycle.retry()}
        >
          Retry
        </button>
      </section>
    );
  return (
    <section
      id="research-lifecycle"
      className={card}
      aria-label="Research cohort and team"
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
        Research Cohort → Research Team → Research Process
      </p>
      <h2 className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
        {project
          ? "Your research study"
          : state === "TEAM_FORMING"
            ? "Prepare your research team"
            : "Your research journey"}
      </h2>
      <p className="mt-2 text-base text-[var(--color-text-secondary)]">
        {researcherLifecycleMessage[state]}
      </p>
      {lifecycle.invalidContext && (
        <p role="alert" className="mt-2 text-sm text-amber-700">
          That research context is unavailable. Choose one of your authorized
          cohorts, teams or studies below.
        </p>
      )}
      {activeCohorts.length > 0 && (
        <label className="mt-4 block text-sm font-semibold text-[var(--color-text-primary)]">
          Research Cohort
          <select
            className={input}
            value={cohort?.status === "ACTIVE" ? cohort.id : ""}
            onChange={(event) => {
              setCreatingTeam(false);
              setConfirmStart(false);
              startAction.reset();
              lifecycle.chooseContext(event.target.value);
            }}
            disabled={startAction.isPending || createAction.isPending}
          >
            <option value="" disabled>
              Choose a research cohort
            </option>
            {activeCohorts.map((item) => (
              <option key={item.id} value={item.id}>
                {[
                  item.name,
                  item.program?.code || item.program?.name,
                  item.researchType?.name,
                  item.academicYear?.name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </select>
        </label>
      )}
      {cohort && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {cohort.name} · {cohort.academicYear?.name} ·{" "}
          {cohort.status.toLowerCase()}
          {cohort.workflow?.name && !project && <> · {cohort.workflow.name}</>}
        </p>
      )}
      {caseChoices.length > 1 || state === "SELECT_CASE" ? (
        <label className="mt-4 block text-sm font-semibold">
          Research study
          <select
            className={input}
            value={project?.id || ""}
            disabled={startAction.isPending || createAction.isPending}
            onChange={(event) => lifecycle.selectCase(event.target.value)}
          >
            <option value="" disabled>
              Choose a research study
            </option>
            {caseChoices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || "Research study"}
                {item.isTitleProvisional ? " — Title pending" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {teamChoices.length > 1 && !project && (
        <label className="mt-4 block text-sm font-semibold">
          Research Team
          <select
            className={input}
            value={team?.id || ""}
            disabled={startAction.isPending || createAction.isPending}
            onChange={(event) =>
              cohort && lifecycle.chooseContext(cohort.id, event.target.value)
            }
          >
            <option value="" disabled>
              Choose a research team
            </option>
            {teamChoices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {project && (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            {project.title || "Research study"}
          </h3>
          {project.isTitleProvisional && (
            <p className="mt-1 text-sm font-semibold text-amber-700">
              Research title pending
            </p>
          )}
          {project.workflowAccessRemoved && (
            <p role="alert" className="mt-2 text-sm">
              Access to this research process is currently restricted. Please
              contact your research coordinator.
            </p>
          )}
          <Link
            className={`${primary} mt-4`}
            to={`/student/dashboard?tab=group&projectId=${encodeURIComponent(project.id)}`}
          >
            Continue Research
          </Link>
        </div>
      )}
      {state === "COHORT_NO_TEAM" && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={primary} onClick={() => setCreatingTeam(true)}>
            Create Research Team
          </button>
          <Link className={secondary} to="/student/join-group">
            Join Research Team
          </Link>
        </div>
      )}
      {team && !project && (
        <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            {team.name}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {team.participationMode === "SOLO"
              ? "Individual research team"
              : "Research team"}{" "}
            · {lifecycle.isLeader ? "You are the team leader" : "Team member"}
          </p>
          <ul className="space-y-2 text-sm">
            {team.members
              ?.filter((member) => !member.leftAt)
              .map((member) => (
                <li key={member.userId}>
                  {[member.user?.firstName, member.user?.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                    member.user?.email ||
                    "Researcher"}{" "}
                  · {member.role === "LEADER" ? "Team leader" : "Member"}
                </li>
              ))}
          </ul>
          {lifecycle.isLeader &&
            team.participationMode === "GROUP" &&
            team.inviteCodeEnabled && (
              <>
                <p className="text-sm">
                  Team invitation code:{" "}
                  <strong className="font-mono">{team.inviteCode}</strong>
                </p>
                <TeamEmailInvitation teamId={team.id} kind="workspace" />
              </>
            )}
          {lifecycle.canStart ? (
            <button
              className={primary}
              onClick={() => {
                createAction.reset();
                startAction.reset();
                setConfirmStart(true);
              }}
              disabled={startAction.isPending}
            >
              Start Research
            </button>
          ) : (
            state === "TEAM_FORMING" && (
              <p className="text-sm font-semibold">
                Waiting for your team leader to start the research process.
              </p>
            )
          )}
        </div>
      )}
      {(createAction.feedback ||
        (!(confirmStart && lifecycle.canStart) && startAction.feedback)) && (
        <p
          role={
            createAction.feedback?.tone === "error" ||
            startAction.feedback?.tone === "error"
              ? "alert"
              : "status"
          }
          className="mt-4 text-sm"
        >
          {createAction.feedback?.message || startAction.feedback?.message}
        </p>
      )}
      {creatingTeam && state === "COHORT_NO_TEAM" && (
        <Modal
          isOpen
          onClose={() => {
            if (!createAction.isPending) setCreatingTeam(false);
          }}
          title="Create Research Team"
          maxWidth="lg"
        >
          <form onSubmit={create} className="space-y-4">
            <p className="text-sm">
              {cohort?.name}. Creating the team does not start research.
            </p>
            <label className="block text-sm font-semibold">
              Team name
              <input
                required
                maxLength={120}
                className={input}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Participation
              <select
                className={input}
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
              >
                <option value="GROUP">Research group</option>
                <option value="SOLO">Individual workspace</option>
              </select>
            </label>
            {mode === "GROUP" && (
              <label className="block text-sm font-semibold">
                Joining permission
                <select
                  className={input}
                  value={accessMode}
                  onChange={(event) =>
                    setAccessMode(event.target.value as typeof accessMode)
                  }
                >
                  <option value="INVITE_ONLY">Invite code</option>
                  <option value="PUBLIC_OPEN">Open code joining</option>
                </select>
              </label>
            )}
            {createAction.feedback?.tone === "error" && (
              <p role="alert" className="text-sm text-red-700">
                {createAction.feedback.message}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={secondary}
                disabled={createAction.isPending}
                onClick={() => setCreatingTeam(false)}
              >
                Cancel
              </button>
              <button
                className={primary}
                disabled={!name.trim() || createAction.isPending}
              >
                {createAction.isPending
                  ? "Creating team…"
                  : "Create Research Team"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirmStart && lifecycle.canStart && (
        <Modal
          isOpen
          onClose={() => {
            if (!startAction.isPending) setConfirmStart(false);
          }}
          title="Start your team's research process?"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <p className="text-base text-[var(--color-text-secondary)]">
              Advisio will create your research record using the process
              assigned to your cohort. Your team can then begin completing its
              configured research requirements.
            </p>
            {startAction.feedback?.tone === "error" && (
              <p role="alert" className="text-sm text-red-700">
                {startAction.feedback.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className={secondary}
                disabled={startAction.isPending}
                onClick={() => setConfirmStart(false)}
              >
                Cancel
              </button>
              <button
                className={primary}
                onClick={start}
                disabled={startAction.isPending}
              >
                {startAction.isPending
                  ? "Starting research…"
                  : "Start Research"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function ResearchStartNotice() {
  return (
    <section className={card}>
      <h3 className="text-lg font-bold">Start research with your team</h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Prepare your cohort-linked team first. The team leader can then start
        the assigned research process.
      </p>
      <Link className={`${primary} mt-4`} to="/student/dashboard?tab=group">
        Open Research Team
      </Link>
    </section>
  );
}
