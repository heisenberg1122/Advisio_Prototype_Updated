import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAsyncAction } from "@/hooks/use-async-action";
import { apiClient } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import {
  addCoordinatorResearcher,
  assignCoordinatorProcess,
  canManageCohorts,
  cohortActions,
  cohortError,
  cohortKeys,
  createCoordinatorCohort,
  eligibleProcesses,
  loadCoordinatorCohorts,
  removeCoordinatorResearcher,
  scopedPrograms,
  statusLabels,
  updateCoordinatorCohort,
  type AcademicProgram,
  type AcademicYear,
  type CohortMember,
  type CohortStatus,
  type CoordinatorCohort,
  type ProcessOption,
  type ResearcherOption,
} from "@/lib/coordinator-cohorts";

const card =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-[var(--college-on-primary)] disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-50";
const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)]";
export function CohortSetupGuide() {
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">Organize research through cohorts</h2>
      <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Create Research Cohort",
          "Assign Research Process",
          "Add Researchers",
          "Activate Cohort",
          "Researchers create or join teams",
          "Team leader starts research",
          "Monitor Research Cases",
        ].map((step, index) => (
          <li key={step}>
            <span className="mr-2 font-bold text-[var(--color-primary)]">
              {index + 1}.
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        Process Templates are reusable definitions. Cohorts organize academic
        membership; process access remains a separate authorization.
      </p>
    </section>
  );
}
export function CohortList({
  cohorts,
  onCreate,
  filtered = false,
}: {
  cohorts: CoordinatorCohort[];
  onCreate: () => void;
  filtered?: boolean;
}) {
  if (!cohorts.length)
    return (
      <section className={`${card} text-center`}>
        <h2 className="text-xl font-bold">
          {filtered
            ? "No cohorts match your search"
            : "No research cohorts yet"}
        </h2>
        <p className="my-3 text-[var(--color-text-secondary)]">
          Create a research cohort to organize researchers and assign the
          process they will follow.
        </p>
        <button className={primary} onClick={onCreate}>
          Create Research Cohort
        </button>
      </section>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cohorts.map((cohort) => (
        <article key={cohort.id} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 break-words text-lg font-bold">
              {cohort.name}
            </h2>
            <CohortStatusBadge status={cohort.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Program", cohort.program.name],
              ["Research Track", cohort.researchType.name],
              ["Academic Year", cohort.academicYear.name],
              [
                "Assigned Process",
                cohort.workflow
                  ? `${cohort.workflow.name} · v${cohort.workflow.version} · ${cohort.workflow.status.toLowerCase()}`
                  : "Not assigned",
              ],
              ["Active Researchers", cohort._count.members],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                <dd className="mt-1 break-words font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            className={`${secondary} mt-4`}
            to={`/professor/cohorts/${encodeURIComponent(cohort.id)}`}
          >
            View / Manage
          </Link>
        </article>
      ))}
    </div>
  );
}
export function CohortStatusBadge({ status }: { status: CohortStatus }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : status === "DRAFT" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}
    >
      {statusLabels[status]}
    </span>
  );
}
export default function CoordinatorCohortsPage() {
  const { user } = useAuth();
  if (!canManageCohorts(user))
    return (
      <main className="p-6">
        <p role="alert">
          Research Coordinator access is required to manage cohorts.
        </p>
      </main>
    );
  return <CoordinatorCohortsContent />;
}
function CoordinatorCohortsContent() {
  const { user } = useAuth();
  const { id } = useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const cohorts = useQuery({
    queryKey: cohortKeys.list,
    queryFn: loadCoordinatorCohorts,
    refetchInterval: 15000,
  });
  const programs = useQuery({
    queryKey: ["coordinator-cohort-programs", user?.id, user?.college?.id],
    queryFn: () =>
      apiClient.get<{ programs: AcademicProgram[] }>("/api/programs", {
        params: { collegeId: user?.college?.id },
      }),
    enabled: creating,
  });
  const years = useQuery({
    queryKey: ["coordinator-cohort-years"],
    queryFn: () =>
      apiClient.get<{ academicYears: AcademicYear[] }>("/api/academic-years"),
    enabled: creating,
  });
  const action = useAsyncAction();
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !user ||
      !programs.data ||
      !years.data ||
      programs.isError ||
      years.isError
    )
      return;
    const form = new FormData(event.currentTarget);
    const draft = Object.fromEntries(
      [
        "name",
        "description",
        "programId",
        "researchTypeId",
        "academicYearId",
      ].map((key) => [key, String(form.get(key) || "")]),
    ) as {
      name: string;
      description: string;
      programId: string;
      researchTypeId: string;
      academicYearId: string;
    };
    await action
      .run(
        async () => {
          const cohort = await createCoordinatorCohort(
            client,
            user,
            programs.data.programs,
            years.data.academicYears,
            draft,
          );
          setCreating(false);
          navigate(`/professor/cohorts/${encodeURIComponent(cohort.id)}`);
        },
        {
          successMessage: "Research cohort created.",
          errorMessage: cohortError,
        },
      )
      .catch(() => undefined);
  }
  return (
    <main className="mx-auto w-full max-w-[1360px] space-y-5 p-4 text-[var(--color-text-primary)] sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Research Cohorts</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Manage academic batches, researchers and their assigned process.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/professor/dashboard?tab=builder" className={secondary}>
            Process Templates
          </Link>
          <button
            className={primary}
            onClick={() => {
              action.reset();
              setCreating(true);
            }}
          >
            Create Research Cohort
          </button>
        </div>
      </header>
      {action.feedback && !creating && (
        <p role={action.feedback.tone === "error" ? "alert" : "status"}>
          {action.feedback.message}
        </p>
      )}
      {id ? (
        <CohortDetail key={id} id={id} />
      ) : (
        <>
          <CohortSetupGuide />
          {cohorts.isPending ? (
            <p role="status">Loading research cohorts…</p>
          ) : cohorts.isError ? (
            <section className={card}>
              <p role="alert">{cohortError(cohorts.error)}</p>
              <button
                className={`${secondary} mt-3`}
                onClick={() => void cohorts.refetch()}
              >
                Retry
              </button>
            </section>
          ) : (
            <>
              <label className="block text-sm font-semibold">
                Find a cohort
                <input
                  className={input}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Search cohort, program, track or year"
                />
              </label>
              <CohortList
                filtered={Boolean(filter.trim())}
                cohorts={(cohorts.data?.cohorts || []).filter((item) =>
                  [
                    item.name,
                    item.program.name,
                    item.researchType.name,
                    item.academicYear.name,
                    statusLabels[item.status],
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )}
                onCreate={() => setCreating(true)}
              />
            </>
          )}
        </>
      )}
      <Modal
        isOpen={creating}
        onClose={() => {
          if (!action.isPending) setCreating(false);
        }}
        title="Create Research Cohort"
        maxWidth="lg"
      >
        {programs.isPending || years.isPending ? (
          <p role="status">Loading academic choices…</p>
        ) : programs.isError || years.isError ? (
          <div>
            <p role="alert">Academic choices could not be loaded.</p>
            <button
              className={secondary}
              onClick={() => {
                void programs.refetch();
                void years.refetch();
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          user && (
            <CohortCreateForm
              key={user.id}
              programs={scopedPrograms(programs.data?.programs || [], user)}
              years={years.data?.academicYears || []}
              pending={action.isPending}
              onSubmit={create}
            />
          )
        )}
        {action.feedback?.tone === "error" && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {action.feedback.message}
          </p>
        )}
      </Modal>
    </main>
  );
}
export function CohortCreateForm({
  programs,
  years,
  pending,
  onSubmit,
}: {
  programs: AcademicProgram[];
  years: AcademicYear[];
  pending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [programId, setProgramId] = useState(
    programs.length === 1 ? programs[0].id : "",
  );
  const program = programs.find((item) => item.id === programId);
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Creates a Draft cohort only. Assign its process and add researchers
        separately.
      </p>
      <label className="block text-sm font-semibold">
        Cohort name
        <input
          name="name"
          required
          minLength={2}
          maxLength={150}
          className={input}
          disabled={pending}
        />
      </label>
      <label className="block text-sm font-semibold">
        Description
        <textarea
          name="description"
          maxLength={5000}
          className={input}
          disabled={pending}
        />
      </label>
      <label className="block text-sm font-semibold">
        Program
        <select
          name="programId"
          required
          value={programId}
          onChange={(event) => setProgramId(event.target.value)}
          className={input}
          disabled={pending}
        >
          <option value="" disabled>
            Choose a program
          </option>
          {programs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.college?.name}
            </option>
          ))}
        </select>
      </label>
      {program && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          College:{" "}
          {program.college?.name || "Determined by the selected program"}
        </p>
      )}
      <label className="block text-sm font-semibold">
        Research Track
        <select
          key={programId}
          name="researchTypeId"
          required
          defaultValue=""
          className={input}
          disabled={!program || pending}
        >
          <option value="" disabled>
            Choose a research track
          </option>
          {program?.researchTypes
            .filter((item) => item.isActive && item.programId === program.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Academic Year
        <select
          name="academicYearId"
          required
          defaultValue=""
          className={input}
          disabled={pending}
        >
          <option value="" disabled>
            Choose an academic year
          </option>
          {years
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      {!programs.length && (
        <p role="alert">
          No active programs are available within your academic scope. Contact
          your administrator.
        </p>
      )}
      <button
        className={primary}
        disabled={
          pending || !programs.length || !years.some((item) => item.isActive)
        }
        aria-busy={pending}
      >
        {pending ? "Creating cohort…" : "Create Research Cohort"}
      </button>
    </form>
  );
}

type DetailConfirmation =
  | { kind: "status"; status: CohortStatus }
  | { kind: "process"; processId: string }
  | { kind: "remove"; member: CohortMember };
function CohortDetail({ id }: { id: string }) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: cohortKeys.detail(id),
    queryFn: () =>
      apiClient.get<{ cohort: CoordinatorCohort }>(
        `/api/cohorts/${encodeURIComponent(id)}`,
      ),
    refetchInterval: 15000,
  });
  const members = useQuery({
    queryKey: cohortKeys.members(id),
    queryFn: () =>
      apiClient.get<{ members: CohortMember[] }>(
        `/api/cohorts/${encodeURIComponent(id)}/members`,
      ),
    enabled: detail.isSuccess,
    refetchInterval: 15000,
  });
  const processes = useQuery({
    queryKey: [
      "coordinator-cohorts",
      "processes",
      detail.data?.cohort.researchTypeId,
    ],
    queryFn: () =>
      apiClient.get<{ workflows: ProcessOption[] }>("/api/workflows", {
        params: { researchTypeId: detail.data!.cohort.researchTypeId },
      }),
    enabled: detail.isSuccess,
  });
  const [editing, setEditing] = useState(false);
  const [processId, setProcessId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<DetailConfirmation | null>(null);
  const action = useAsyncAction();
  const cohort = detail.data?.cohort;
  const researchers = useQuery({
    queryKey: ["coordinator-cohorts", "eligible", id, search, page],
    queryFn: () =>
      apiClient.get<{
        researchers: ResearcherOption[];
        pagination: { page: number; totalPages: number; total: number };
      }>(`/api/cohorts/${encodeURIComponent(id)}/eligible-researchers`, {
        params: { search, page, limit: 20 },
      }),
    enabled: Boolean(
      adding && cohort && cohortActions(cohort).members && !detail.isError,
    ),
    staleTime: 0,
  });
  async function perform(task: () => Promise<unknown>, message: string) {
    await action
      .run(task, { successMessage: message, errorMessage: cohortError })
      .catch(() => undefined);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      await updateCoordinatorCohort(client, id, {
        name: String(form.get("name")).trim(),
        description: String(form.get("description")).trim() || null,
      });
      setEditing(false);
    }, "Cohort updated.");
  }
  async function execute() {
    if (!confirm || !cohort || detail.isError) return;
    await perform(
      async () => {
        if (confirm.kind === "status")
          await updateCoordinatorCohort(client, id, { status: confirm.status });
        if (confirm.kind === "process") {
          if (processes.isError)
            throw new Error(
              "Reload the available process templates before assigning.",
            );
          await assignCoordinatorProcess(
            client,
            cohort,
            processes.data?.workflows || [],
            confirm.processId,
          );
          setProcessId("");
        }
        if (confirm.kind === "remove")
          await removeCoordinatorResearcher(client, id, confirm.member.userId);
        setConfirm(null);
      },
      confirm.kind === "remove"
        ? "Researcher removed from active cohort participation."
        : confirm.kind === "process"
          ? "Research process assigned to cohort."
          : "Cohort status updated.",
    );
  }
  if (detail.isPending) return <p role="status">Loading cohort…</p>;
  if (detail.isError || !cohort)
    return (
      <section className={card}>
        <p role="alert">{cohortError(detail.error)}</p>
        <button
          className={`${secondary} mt-3`}
          onClick={() => void detail.refetch()}
        >
          Retry
        </button>
        <Link className={`${secondary} ml-2`} to="/professor/cohorts">
          All cohorts
        </Link>
      </section>
    );
  const policy = cohortActions(cohort);
  const candidates = eligibleProcesses(processes.data?.workflows || [], cohort);
  return (
    <>
      <Link
        to="/professor/cohorts"
        className="inline-block text-sm font-bold text-[var(--color-primary)]"
      >
        ← All Research Cohorts
      </Link>
      <CohortInformation cohort={cohort} />
      {action.feedback && (
        <p
          role={action.feedback.tone === "error" ? "alert" : "status"}
          className="text-sm"
        >
          {action.feedback.message}
        </p>
      )}
      <section className={card}>
        <h2 className="text-lg font-bold">Cohort configuration</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {policy.edit && (
            <button
              className={secondary}
              disabled={action.isPending}
              onClick={() => {
                action.reset();
                setEditing(true);
              }}
            >
              Edit Cohort
            </button>
          )}
          {policy.statuses.map((status) => (
            <button
              key={status}
              className={secondary}
              disabled={action.isPending}
              onClick={() => {
                action.reset();
                setConfirm({ kind: "status", status });
              }}
            >
              {status === "ACTIVE"
                ? "Activate Cohort"
                : status === "CLOSED"
                  ? "Close Cohort"
                  : "Archive Cohort"}
            </button>
          ))}
        </div>
        {cohort.status === "ARCHIVED" && (
          <p className="mt-3 text-sm">
            Archived cohorts are read-only. Existing research history remains
            available.
          </p>
        )}
        {cohort.status === "CLOSED" && (
          <p className="mt-3 text-sm">
            This cohort is closed. No new research starts; existing records
            remain available. Assignment and membership are locked while closed.
          </p>
        )}
      </section>
      <section className={card}>
        <h2 className="text-lg font-bold">Assigned Process</h2>
        <p className="mt-2">
          {cohort.workflow
            ? `${cohort.workflow.name} · v${cohort.workflow.version} · ${cohort.workflow.status.toLowerCase()}`
            : "No research process assigned."}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Publishing makes a template available for assignment. It does not
          assign it to a cohort or change an existing research case.
        </p>
        {policy.assign ? (
          <div className="mt-4 space-y-3">
            {processes.isPending ? (
              <p role="status">Loading published processes…</p>
            ) : processes.isError ? (
              <div>
                <p role="alert">
                  Available process templates could not be loaded.
                </p>
                <button
                  className={secondary}
                  onClick={() => void processes.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-semibold">
                  Published Process Template
                  <select
                    className={input}
                    value={processId}
                    onChange={(event) => setProcessId(event.target.value)}
                    disabled={action.isPending}
                  >
                    <option value="">Choose a published process</option>
                    {candidates.map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.name} · v{process.version} ·{" "}
                        {cohort.researchType.name} · Published
                      </option>
                    ))}
                  </select>
                </label>
                {!candidates.length && (
                  <p className="text-sm">
                    No published process is available for this research track.
                    Publish a matching template in Process Templates.
                  </p>
                )}
                <button
                  className={primary}
                  disabled={
                    action.isPending ||
                    !candidates.some((item) => item.id === processId) ||
                    processId === cohort.workflowId
                  }
                  onClick={() => {
                    action.reset();
                    setConfirm({ kind: "process", processId });
                  }}
                >
                  Assign Process
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {policy.members
              ? "Process assignment is locked because this cohort has research teams or cases. Existing cases keep their pinned process; no migration is performed here."
              : "Process assignment is locked for this cohort's current status."}
          </p>
        )}
      </section>
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Researchers</h2>
          {policy.members && (
            <button
              className={secondary}
              disabled={action.isPending}
              onClick={() => {
                action.reset();
                setSelectedUser("");
                setAdding((value) => !value);
              }}
            >
              Add Researchers
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Academic cohort membership is separate from process access. Adding or
          removing a researcher here does not change existing process
          permissions or create a research case.
        </p>
        {adding && policy.members && (
          <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] p-4">
            <label className="block text-sm font-semibold">
              Find an eligible researcher
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  setSelectedUser("");
                }}
                maxLength={100}
                className={input}
                placeholder="Search name, email or student identifier"
              />
            </label>
            {researchers.isPending || researchers.isFetching ? (
              <p role="status">Searching researchers…</p>
            ) : researchers.isError ? (
              <div>
                <p role="alert">{cohortError(researchers.error)}</p>
                <button
                  className={secondary}
                  onClick={() => void researchers.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-semibold">
                  Eligible researcher
                  <select
                    value={selectedUser}
                    onChange={(event) => setSelectedUser(event.target.value)}
                    className={input}
                    disabled={action.isPending}
                  >
                    <option value="">Choose a researcher</option>
                    {researchers.data?.researchers.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName} · {person.email}
                        {person.universityId ? ` · ${person.universityId}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm">
                  Active cohort members are excluded. Previously removed
                  researchers can be added again if still eligible.
                </p>
                {!researchers.data?.researchers.length && (
                  <p className="text-sm">
                    No eligible researchers match this search.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className={secondary}
                    disabled={page === 1 || action.isPending}
                    onClick={() => {
                      setPage(page - 1);
                      setSelectedUser("");
                    }}
                  >
                    Previous
                  </button>
                  <span className="text-sm">
                    Page {page} of{" "}
                    {Math.max(1, researchers.data?.pagination.totalPages || 1)}
                  </span>
                  <button
                    className={secondary}
                    disabled={
                      page >= (researchers.data?.pagination.totalPages || 0) ||
                      action.isPending
                    }
                    onClick={() => {
                      setPage(page + 1);
                      setSelectedUser("");
                    }}
                  >
                    Next
                  </button>
                  <button
                    className={primary}
                    disabled={
                      !selectedUser ||
                      action.isPending ||
                      researchers.isError ||
                      researchers.isFetching
                    }
                    aria-busy={action.isPending}
                    onClick={() =>
                      void perform(async () => {
                        await addCoordinatorResearcher(
                          client,
                          id,
                          researchers.data?.researchers || [],
                          selectedUser,
                        );
                        setSelectedUser("");
                      }, "Researcher added to cohort.")
                    }
                  >
                    {action.isPending ? "Adding researcher…" : "Add to Cohort"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {members.isPending ? (
          <p role="status" className="mt-3">
            Loading researchers…
          </p>
        ) : members.isError ? (
          <div className="mt-3">
            <p role="alert">Cohort researchers could not be loaded.</p>
            <button
              className={secondary}
              onClick={() => void members.refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
          <CohortRoster
            members={members.data?.members || []}
            canManage={policy.members}
            pending={action.isPending}
            onRemove={(member) => {
              action.reset();
              setConfirm({ kind: "remove", member });
            }}
          />
        )}
      </section>
      <Modal
        isOpen={editing && policy.edit}
        title="Edit Cohort"
        onClose={() => {
          if (!action.isPending) setEditing(false);
        }}
      >
        <form onSubmit={save} className="space-y-4">
          <p className="text-sm">
            Academic context is fixed for this cohort. Only name and description
            can be edited.
          </p>
          <label className="block text-sm font-semibold">
            Cohort name
            <input
              required
              minLength={2}
              maxLength={150}
              name="name"
              defaultValue={cohort.name}
              className={input}
              disabled={action.isPending}
            />
          </label>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              name="description"
              defaultValue={cohort.description || ""}
              maxLength={5000}
              className={input}
              disabled={action.isPending}
            />
          </label>
          <button className={primary} disabled={action.isPending}>
            {action.isPending ? "Saving…" : "Save Changes"}
          </button>
          {action.feedback?.tone === "error" && (
            <p role="alert">{action.feedback.message}</p>
          )}
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(confirm)}
        title={
          confirm?.kind === "remove"
            ? "Remove researcher from this cohort?"
            : confirm?.kind === "process"
              ? "Assign this research process?"
              : `${confirm?.kind === "status" ? statusLabels[confirm.status] : "Change"} cohort?`
        }
        onClose={() => {
          if (!action.isPending) setConfirm(null);
        }}
      >
        <div className="space-y-4">
          <p>
            {confirm?.kind === "remove"
              ? "This removes the researcher from active cohort participation. Existing research records and historical activity are preserved according to system policy."
              : confirm?.kind === "process"
                ? "Existing research cases keep their current process. New cases started after this change will use the newly assigned process. Assignment is allowed only while no research teams or cases are linked."
                : confirm?.kind === "status" && confirm.status === "ACTIVE"
                  ? "Activate this cohort for researcher team formation and explicit research start. A valid published process is required."
                  : "New research cannot start in a closed or archived cohort. Existing research records remain available according to access policy."}
          </p>
          {action.feedback?.tone === "error" && (
            <p role="alert">{action.feedback.message}</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className={secondary}
              disabled={action.isPending}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className={primary}
              disabled={action.isPending}
              onClick={() => void execute()}
              aria-busy={action.isPending}
            >
              {action.isPending ? "Updating cohort…" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
export function CohortInformation({ cohort }: { cohort: CoordinatorCohort }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="break-words text-xl font-bold">{cohort.name}</h2>
        <CohortStatusBadge status={cohort.status} />
      </div>
      {cohort.description && (
        <p className="mt-3 whitespace-pre-wrap break-words text-[var(--color-text-secondary)]">
          {cohort.description}
        </p>
      )}
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["College", cohort.college.name],
          ["Program", cohort.program.name],
          ["Research Track", cohort.researchType.name],
          ["Academic Year", cohort.academicYear.name],
          ["Active Researchers", cohort._count.members],
          ["Research Teams", cohort._count.workspaces],
          ["Research Cases", cohort._count.researchProjects],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        Team and case totals come from the cohort record. Detailed team
        monitoring is separate.
      </p>
      <Link
        className={`${secondary} mt-3`}
        to={`/professor/dashboard?tab=monitoring&cohortId=${encodeURIComponent(cohort.id)}`}
      >
        Monitor Research Cases
      </Link>
    </section>
  );
}
export function CohortRoster({
  members,
  canManage,
  pending,
  onRemove,
}: {
  members: CohortMember[];
  canManage: boolean;
  pending: boolean;
  onRemove: (member: CohortMember) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      {!members.length && (
        <p className="text-sm">No researchers in this cohort yet.</p>
      )}
      {members.map((member) => (
        <article
          key={member.id}
          className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:flex-row sm:items-center"
        >
          <div>
            <p className="font-semibold">
              {member.user.firstName} {member.user.lastName}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {member.status === "ACTIVE"
                ? "Active member"
                : "Removed · historical membership"}
              {member.removedAt
                ? ` · ${new Date(member.removedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
          {canManage && member.status === "ACTIVE" && (
            <button
              className={secondary}
              disabled={pending}
              onClick={() => onRemove(member)}
            >
              Remove Researcher
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
