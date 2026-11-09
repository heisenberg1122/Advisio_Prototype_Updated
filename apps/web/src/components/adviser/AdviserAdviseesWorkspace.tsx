import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyNote, SegmentedSwitch, StatusDot } from "@/components/ui/advisio";
import {
  AdviserResearchGroupCard,
  adviserGroupInitial,
  adviserGroupStatusTone,
  readableAdviserGroupStatus,
} from "./AdviserResearchGroupCard";
import "./advisees-workspace.css";

export type AdviseeGroup = {
  id: string;
  groupName: string;
  projectTitle?: string;
  status: string;
  currentStage: string;
  progress: number;
  members: unknown[];
  pendingTasks: number;
  leader: string;
};

type AdviserCapacity = {
  adviseeCount: number;
  maxAdviseeGroups: number;
  availableSlots: number;
  isFull: boolean;
  isAcceptingAdvisees: boolean;
};

type Filter = "all" | "attention" | "completed";
type Sort = "pending" | "progress-asc" | "progress-desc" | "name";
type View = "cards" | "list";

const SORT_OPTIONS: Array<{ value: Sort; label: string }> = [
  { value: "pending", label: "Most pending first" },
  { value: "progress-asc", label: "Lowest progress first" },
  { value: "progress-desc", label: "Highest progress first" },
  { value: "name", label: "Group name A–Z" },
];

const SORT_KEY = "advisio:adviser-advisees-sort";
const VIEW_KEY = "advisio:adviser-advisees-view";

// Storage can be blocked in private windows; the page still works with the defaults.
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice just won't be remembered.
  }
}

const isCompleted = (group: AdviseeGroup) => group.status.toUpperCase() === "COMPLETED" || group.progress >= 100;
const needsAttention = (group: AdviseeGroup) => !isCompleted(group) && group.pendingTasks > 0;
const compareNames = (a: AdviseeGroup, b: AdviseeGroup) =>
  a.groupName.localeCompare(b.groupName, undefined, { numeric: true, sensitivity: "base" });

function SortMenu({ value, onChange }: { value: Sort; onChange: (value: Sort) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    items[event.key === "ArrowDown" ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)]?.focus();
  };

  return (
    <div ref={root} className="aw-sort">
      <button ref={trigger} type="button" className="aw-sort-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <i className="ti ti-arrows-sort" aria-hidden="true" />
        {SORT_OPTIONS.find((option) => option.value === value)?.label}
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="aw-sort-menu" role="menu" aria-label="Sort groups" onKeyDown={moveFocus}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {option.label}
              {option.value === value && <i className="ti ti-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdviserAdviseesWorkspace({
  advisees,
  loading,
  countsLoading = false,
  error,
  onRetry,
  capacity,
  seal,
  onNavigate,
}: {
  advisees: AdviseeGroup[];
  loading: boolean;
  /** Pending counts and progress arrive after the groups themselves. */
  countsLoading?: boolean;
  error: boolean;
  onRetry: () => void;
  capacity?: AdviserCapacity | null;
  seal?: string;
  onNavigate: (tab: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>(() => readStored(SORT_KEY, ["pending", "progress-asc", "progress-desc", "name"], "pending"));
  const [view, setView] = useState<View>(() => readStored(VIEW_KEY, ["cards", "list"], "cards"));

  const attentionGroups = advisees.filter(needsAttention);
  const completedGroups = advisees.filter(isCompleted);
  const totalPending = attentionGroups.reduce((sum, group) => sum + group.pendingTasks, 0);
  const researcherCount = advisees.reduce((sum, group) => sum + group.members.length, 0);
  const averageProgress = advisees.length
    ? Math.round(advisees.reduce((sum, group) => sum + Math.min(100, Math.max(0, group.progress)), 0) / advisees.length)
    : 0;
  const busiestGroup = [...attentionGroups].sort((a, b) => b.pendingTasks - a.pendingTasks || compareNames(a, b))[0];

  const visible = useMemo(() => {
    const filtered = advisees.filter((group) =>
      filter === "attention" ? needsAttention(group) : filter === "completed" ? isCompleted(group) : true,
    );
    return filtered.sort((a, b) => {
      if (sort === "name") return compareNames(a, b);
      if (sort === "progress-asc") return a.progress - b.progress || compareNames(a, b);
      if (sort === "progress-desc") return b.progress - a.progress || compareNames(a, b);
      return b.pendingTasks - a.pendingTasks || compareNames(a, b);
    });
  }, [advisees, filter, sort]);

  const summary = !advisees.length
    ? "View your research groups, track progress, and open their workspaces."
    : countsLoading
      ? "Checking pending work across your research groups…"
      : totalPending && busiestGroup
      ? `${totalPending} ${totalPending === 1 ? "task is" : "tasks are"} pending across ${attentionGroups.length} ${attentionGroups.length === 1 ? "group" : "groups"}. ${busiestGroup.groupName} has the most.`
      : "No tasks are pending across your research groups.";

  const counts: Array<{ label: string; value: number; target: Filter; waiting?: boolean }> = [
    { label: "Groups", value: advisees.length, target: "all" },
    { label: "Pending", value: totalPending, target: "attention", waiting: totalPending > 0 },
    { label: "Completed", value: completedGroups.length, target: "completed" },
  ];

  const emptyFilterText =
    countsLoading
      ? { title: "Checking your groups…", text: "Pending work is still loading." }
      : filter === "attention"
      ? { title: "Nothing needs attention", text: "No active group has pending tasks right now." }
      : { title: "No completed groups yet", text: "Groups appear here once their research workflow is finished." };

  return (
    <div className="adviser-overview mx-auto flex w-full max-w-[1360px] flex-col gap-6">
      <section className="adviser-overview__hero phone-slim-hero" aria-labelledby="adviser-advisees-title">
        {seal && <img className="adviser-overview__seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
        <header className="adviser-overview__hero-heading">
          <div>
            <p className="adviser-overview__eyebrow">Advisee management</p>
            <h1 id="adviser-advisees-title">
              <span
                data-tour="advisee-records"
                data-guide={!loading && !error ? "adviser-group-list" : undefined}
                data-guide-empty={advisees.length === 0}
              >
                Your research groups
              </span>
            </h1>
            <p>{summary}</p>
          </div>
          <section className="adviser-overview__workload" aria-label="Advisee summary">
            {counts.map((item) => (
              <button
                key={item.label}
                type="button"
                className="adviser-overview__workload-item"
                data-waiting={item.waiting ? "true" : undefined}
                aria-pressed={filter === item.target}
                title={`Show ${item.target === "all" ? "all groups" : item.target === "attention" ? "groups that need attention" : "completed groups"}`}
                onClick={() => setFilter(item.target)}
              >
                <span className="adviser-overview__metric-value">{error || (countsLoading && item.target !== "all") ? "—" : item.value}</span>
                <span className="adviser-overview__metric-label">{item.label}</span>
              </button>
            ))}
            {capacity && (
              <div
                className="adviser-overview__workload-item aw-capacity"
                data-guide="adviser-capacity"
                title={!capacity.isAcceptingAdvisees ? "New requests are paused." : capacity.isFull ? "Capacity reached." : `${capacity.availableSlots} available.`}
              >
                <span className="adviser-overview__metric-value">
                  {capacity.adviseeCount}/{capacity.maxAdviseeGroups}
                </span>
                <span className="adviser-overview__metric-label">Capacity</span>
              </div>
            )}
          </section>
        </header>
        <div className="adviser-overview__hero-actions">
          <button type="button" className="adviser-overview__hero-primary" data-phone-label="Review" onClick={() => onNavigate("reviews")}>
            <i className="ti ti-file-search" aria-hidden="true" /> Review documents
          </button>
          <button type="button" className="adviser-overview__hero-secondary" onClick={() => onNavigate("group-chats")}>
            <i className="ti ti-messages" aria-hidden="true" /> Message groups
          </button>
          <button type="button" className="adviser-overview__hero-secondary" onClick={() => onNavigate("progress")}>
            <i className="ti ti-chart-line" aria-hidden="true" /> Track progress
          </button>
        </div>
      </section>

      {!advisees.length ? (
        <div className="aw-panel">
          {error ? (
            <EmptyNote
              layout="page"
              tone="problem"
              icon="ti-alert-triangle"
              title="We couldn’t load your research groups"
              text="Your connection may have dropped. Try again in a moment."
              action={<button type="button" className="aw-retry" onClick={onRetry}>Try again</button>}
            />
          ) : (
            <EmptyNote
              layout="page"
              icon="ti-users"
              title={loading ? "Loading your research groups…" : "No research groups yet"}
              text={loading ? undefined : "Research groups appear here after you accept their adviser requests."}
            />
          )}
        </div>
      ) : (
        <>
          <div className="aw-tools">
            <SegmentedSwitch<Filter>
              label="Filter research groups"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: advisees.length },
                { value: "attention", label: "Needs attention", count: countsLoading ? undefined : attentionGroups.length },
                { value: "completed", label: "Completed", count: countsLoading ? undefined : completedGroups.length },
              ]}
            />
            <div className="aw-tools-end">
              <SortMenu
                value={sort}
                onChange={(next) => {
                  setSort(next);
                  writeStored(SORT_KEY, next);
                }}
              />
              <SegmentedSwitch<View>
                label="View"
                value={view}
                onChange={(next) => {
                  setView(next);
                  writeStored(VIEW_KEY, next);
                }}
                options={[
                  { value: "cards", label: <><i className="ti ti-layout-grid" aria-hidden="true" /> Cards</> },
                  { value: "list", label: <><i className="ti ti-list" aria-hidden="true" /> List</> },
                ]}
              />
            </div>
          </div>
          <p className="sr-only" role="status">
            Showing {visible.length} of {advisees.length} groups.
          </p>

          {!visible.length ? (
            <div className="aw-panel">
              <EmptyNote
                layout="page"
                tone={filter === "attention" ? "ok" : undefined}
                icon={filter === "attention" ? "ti-circle-check" : "ti-flag"}
                title={emptyFilterText.title}
                text={emptyFilterText.text}
                action={<button type="button" className="aw-retry" onClick={() => setFilter("all")}>Show all groups</button>}
              />
            </div>
          ) : view === "cards" ? (
            <div className="aw-grid">
              {visible.map((group) => (
                <AdviserResearchGroupCard
                  key={group.id}
                  title={group.projectTitle || "Research Study"}
                  groupName={group.groupName}
                  status={group.status}
                  currentStage={group.currentStage}
                  progress={group.progress}
                  memberCount={group.members.length}
                  pendingTasks={group.pendingTasks}
                  leader={group.leader}
                  href={`/adviser/advisees/${group.id}`}
                />
              ))}
              {/* Fills the leftover grid cells so a row never ends with a hole. */}
              <aside
                className="aw-glance"
                data-md={visible.length % 2}
                data-xl={(3 - (visible.length % 3)) % 3}
                style={{ "--aw-xl-span": (3 - (visible.length % 3)) % 3 } as React.CSSProperties}
                aria-label="All groups at a glance"
              >
                <h2>All groups at a glance</h2>
                <p>Across everything you advise.</p>
                <div className="aw-glance-stats">
                  <div>
                    <strong>{averageProgress}%</strong>
                    <span>Average progress</span>
                  </div>
                  <div>
                    <strong>{researcherCount}</strong>
                    <span>Researchers</span>
                  </div>
                </div>
                <div className="aw-glance-actions">
                  <button type="button" onClick={() => onNavigate("group-chats")}>
                    <i className="ti ti-messages" aria-hidden="true" /> Message
                  </button>
                  <button type="button" onClick={() => onNavigate("progress")}>
                    <i className="ti ti-chart-line" aria-hidden="true" /> Progress
                  </button>
                </div>
              </aside>
            </div>
          ) : (
            <div className="aw-table">
              <div className="aw-row aw-row--head" aria-hidden="true">
                <span>Research group</span>
                <span>Current stage</span>
                <span>Progress</span>
                <span>Pending</span>
                <span>Status</span>
                <span />
              </div>
              <ul>
                {visible.map((group) => {
                  const progress = Math.min(100, Math.max(0, group.progress));
                  const title = group.projectTitle || "Research Study";
                  return (
                    <li key={group.id}>
                      <Link href={`/adviser/advisees/${group.id}`} className="aw-row" data-guide="adviser-group-card" aria-label={`Open ${group.groupName}: ${title}`}>
                        <span className="aw-group">
                          <span className="aw-mono" aria-hidden="true">{adviserGroupInitial(group.groupName)}</span>
                          <span className="aw-group-text">
                            <strong title={title}>{title}</strong>
                            <small>{group.groupName} · {group.members.length} members · lead {group.leader}</small>
                          </span>
                        </span>
                        <span className="aw-stage" title={group.currentStage}>{group.currentStage}</span>
                        <span className="aw-progress">
                          <span className="aw-track" aria-hidden="true">
                            <i data-complete={progress >= 100 ? "true" : undefined} style={{ width: `${progress}%` }} />
                          </span>
                          <b>{progress}%</b>
                        </span>
                        <span>
                          {group.pendingTasks ? <span className="aw-pending">{group.pendingTasks} pending</span> : <span className="aw-none">None</span>}
                        </span>
                        <StatusDot tone={adviserGroupStatusTone(group.status)}>{readableAdviserGroupStatus(group.status)}</StatusDot>
                        <i className="ti ti-chevron-right aw-chevron" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
