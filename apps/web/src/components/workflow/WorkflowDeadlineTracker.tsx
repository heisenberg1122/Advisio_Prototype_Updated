export type WorkflowDeadlineRow = {
  key: string;
  researchId: string;
  taskId: string;
  workflowId: string;
  workflowName: string;
  projectTitle: string;
  milestoneName: string;
  milestoneSequence: number;
  requirementTitle: string;
  dueAt: string | null;
  projected: boolean;
  status: "NOT_SUBMITTED" | "SUBMITTED" | "SUBMITTED_LATE" | "OVERDUE" | "REVISION_REQUIRED" | "REVISION_OVERDUE" | "APPROVED" | "NO_DEADLINE";
};

type DeadlineFilter = "UPCOMING" | "OVERDUE" | "NO_DEADLINE" | "ALL";
type DeadlineSort = "DUE_SOON" | "MOST_OVERDUE" | "GROUP" | "MILESTONE";

type WorkflowDeadlineTrackerProps = {
  rows: WorkflowDeadlineRow[];
  filter: DeadlineFilter;
  sort: DeadlineSort;
  selectedKeys: string[];
  reminderSaving: boolean;
  onFilterChange: (value: DeadlineFilter) => void;
  onSortChange: (value: DeadlineSort) => void;
  onSelectionChange: (keys: string[]) => void;
  onSendReminders: () => void;
};

const STATUS_LABELS: Record<WorkflowDeadlineRow["status"], string> = {
  NOT_SUBMITTED: "Not submitted",
  SUBMITTED: "Submitted",
  SUBMITTED_LATE: "Submitted late",
  OVERDUE: "Overdue",
  REVISION_REQUIRED: "Revision requested",
  REVISION_OVERDUE: "Revision overdue",
  APPROVED: "Approved",
  NO_DEADLINE: "No deadline",
};

function statusClass(status: WorkflowDeadlineRow["status"]) {
  if (status === "OVERDUE" || status === "REVISION_OVERDUE") return "bg-rose-100 text-rose-800";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  if (status === "SUBMITTED" || status === "SUBMITTED_LATE") return "bg-blue-100 text-blue-800";
  if (status === "REVISION_REQUIRED") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function deadlineDate(row: WorkflowDeadlineRow) {
  if (!row.dueAt) return "No deadline";
  const value = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(row.dueAt));
  return row.projected ? `${value} · Projected` : value;
}

function isRemindable(row: WorkflowDeadlineRow) {
  return ["NOT_SUBMITTED", "OVERDUE", "REVISION_REQUIRED", "REVISION_OVERDUE"].includes(row.status);
}

export function WorkflowDeadlineTracker({
  rows,
  filter,
  sort,
  selectedKeys,
  reminderSaving,
  onFilterChange,
  onSortChange,
  onSelectionChange,
  onSendReminders,
}: WorkflowDeadlineTrackerProps) {
  const now = Date.now();
  const matchesFilter = (row: WorkflowDeadlineRow) => {
    if (filter === "ALL") return true;
    if (filter === "NO_DEADLINE") return row.status === "NO_DEADLINE";
    if (filter === "OVERDUE") return ["OVERDUE", "REVISION_OVERDUE"].includes(row.status);
    return Boolean(row.dueAt) && (row.projected || new Date(row.dueAt!).getTime() >= now) && row.status !== "APPROVED";
  };
  const visibleRows = rows
    .filter(matchesFilter)
    .sort((a, b) => {
      if (sort === "GROUP") return a.projectTitle.localeCompare(b.projectTitle);
      if (sort === "MILESTONE") return a.milestoneSequence - b.milestoneSequence || a.requirementTitle.localeCompare(b.requirementTitle);
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return sort === "MOST_OVERDUE" ? aDue - bDue : aDue - bDue;
    });
  const reminderRows = visibleRows.filter(isRemindable);
  const selectableKeys = reminderRows.map((row) => row.key);
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((key) => selectedKeys.includes(key));
  const counts = {
    UPCOMING: rows.filter((row) => Boolean(row.dueAt) && (row.projected || new Date(row.dueAt!).getTime() >= now) && row.status !== "APPROVED").length,
    OVERDUE: rows.filter((row) => ["OVERDUE", "REVISION_OVERDUE"].includes(row.status)).length,
    NO_DEADLINE: rows.filter((row) => row.status === "NO_DEADLINE").length,
    ALL: rows.length,
  };

  const toggleAll = () => {
    onSelectionChange(allSelected ? selectedKeys.filter((key) => !selectableKeys.includes(key)) : Array.from(new Set([...selectedKeys, ...selectableKeys])));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#d98d00]">Delivery schedule</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#102f49]">Deadline tracker</h2>
            <p className="mt-1 text-sm text-slate-500">Monitor active requirements and projected dates for upcoming milestones.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-500">
              Sort by
              <select value={sort} onChange={(event) => onSortChange(event.target.value as DeadlineSort)} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                <option value="DUE_SOON">Due soon</option>
                <option value="MOST_OVERDUE">Most overdue</option>
                <option value="GROUP">Research group A–Z</option>
                <option value="MILESTONE">Milestone order</option>
              </select>
            </label>
            <button type="button" onClick={onSendReminders} disabled={reminderSaving || selectedKeys.length === 0} className="rounded-xl bg-[#173f63] px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">
              <i className="ti ti-bell mr-1.5" />{reminderSaving ? "Sending…" : `Send reminders${selectedKeys.length ? ` (${selectedKeys.length})` : ""}`}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(["UPCOMING", "OVERDUE", "NO_DEADLINE", "ALL"] as const).map((value) => (
            <button key={value} type="button" onClick={() => onFilterChange(value)} className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${filter === value ? "bg-[#173f63] text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-[#f6a800]"}`}>
              {value === "UPCOMING" ? "Upcoming" : value === "OVERDUE" ? "Overdue" : value === "NO_DEADLINE" ? "No deadline" : "All"} ({counts[value]})
            </button>
          ))}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500"><i className="ti ti-calendar-check text-2xl" /></span>
          <h3 className="mt-3 font-extrabold text-[#102f49]">No deadlines in this view</h3>
          <p className="mt-1 text-sm text-slate-500">Try another workflow or deadline filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-5 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select visible deadlines" className="h-4 w-4 accent-[#173f63]" /></th>
                <th className="px-3 py-3">Requirement</th>
                <th className="px-5 py-3">Research group</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Submission status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => {
                const selectable = isRemindable(row);
                return (
                  <tr key={row.key} className="text-sm hover:bg-amber-50/30">
                    <td className="px-5 py-4"><input type="checkbox" disabled={!selectable} checked={selectedKeys.includes(row.key)} onChange={(event) => onSelectionChange(event.target.checked ? [...selectedKeys, row.key] : selectedKeys.filter((key) => key !== row.key))} aria-label={`Select ${row.requirementTitle} for ${row.projectTitle}`} className="h-4 w-4 accent-[#173f63] disabled:opacity-30" /></td>
                    <td className="px-3 py-4"><strong className="block text-[#102f49]">{row.requirementTitle}</strong><span className="mt-0.5 block text-xs text-slate-500">{row.milestoneName}</span></td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{row.projectTitle}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{deadlineDate(row)}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClass(row.status)}`}>{STATUS_LABELS[row.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
