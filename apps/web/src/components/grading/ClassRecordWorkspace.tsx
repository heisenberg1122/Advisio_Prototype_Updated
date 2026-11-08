import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  Download,
  History,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatReviewDateTime } from "@/lib/review-date";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  periodLabels,
  recordPeriods,
  type RecordClass,
  type RecordSnapshot,
  type StudentRecord,
  type TeacherRecord,
} from "./class-record-types";
import "./class-record.css";

const percentage = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(2)}%`;
const scoreText = (score: number | null, max: number, state: string) =>
  state === "EXCUSED"
    ? "Excused"
    : state === "MISSING"
      ? `0/${max} · Missing`
      : score === null
        ? "Ungraded"
        : `${score}/${max}`;
const statusLabels: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};
type ScoreEdit = {
  itemId: string;
  studentId: string;
  state: string;
  score: string;
};

export default function ClassRecordWorkspace({
  student = false,
}: {
  student?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const [classes, setClasses] = useState<RecordClass[]>([]);
  const [workflowId, setWorkflowId] = useState(params.get("workflowId") || "");
  const [record, setRecord] = useState<TeacherRecord | null>(null);
  const [mine, setMine] = useState<StudentRecord | null>(null);
  const [code, setCode] = useState("PRELIM");
  const [mode, setMode] = useState("grades");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [scoreEdits, setScoreEdits] = useState<Record<string, ScoreEdit>>({});
  const [markEdits, setMarkEdits] = useState<
    Record<
      string,
      { sessionId: string; studentId: string; status: string | null }
    >
  >({});
  const [dialog, setDialog] = useState<
    "item" | "session" | "settings" | "release" | null
  >(null);
  const [releaseIds, setReleaseIds] = useState<string[] | undefined>();
  const [form, setForm] = useState<any>({});
  const requestId = useRef(0);
  const dirty = Object.keys(scoreEdits).length + Object.keys(markEdits).length;
  const period = record?.periods.find((p) => p.code === code);
  const released = mine?.periods.find((p) => p.code === code)?.release;
  const clearEdits = () => {
    setScoreEdits({});
    setMarkEdits({});
  };
  const allowSwitch = () =>
    !dirty || window.confirm("Discard the unsaved changes in this period?");

  useEffect(() => {
    let alive = true;
    apiClient
      .get<{ classes: RecordClass[] }>(
        `/api/class-records${student ? "/mine" : ""}`,
      )
      .then((data) => {
        if (!alive) return;
        setClasses(data.classes);
        setWorkflowId((current) =>
          data.classes.some((c) => c.id === current)
            ? current
            : data.classes[0]?.id || "",
        );
        if (!data.classes.length) setLoading(false);
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [student]);
  const load = useCallback(async () => {
    if (!workflowId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.get<TeacherRecord | StudentRecord>(
        `/api/class-records/${workflowId}${student ? "/mine" : ""}`,
      );
      if (id !== requestId.current) return;
      if (student) setMine(data as StudentRecord);
      else setRecord(data as TeacherRecord);
      setScoreEdits({});
      setMarkEdits({});
    } catch (e: any) {
      if (id === requestId.current) {
        setError(e.message);
        setRecord(null);
        setMine(null);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [workflowId, student]);
  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const chooseClass = (id: string) => {
    if (!allowSwitch()) return;
    clearEdits();
    setWorkflowId(id);
    setRecord(null);
    setMine(null);
    setReason("");
    setNotice("");
    const next = new URLSearchParams(params);
    next.set("workflowId", id);
    setParams(next, { replace: true });
  };
  const changeTab = (nextCode: string, nextMode = mode) => {
    if (!allowSwitch()) return;
    clearEdits();
    setCode(nextCode);
    setMode(nextMode);
    setNotice("");
    setReason("");
  };
  const mutate = async (action: string, payload: unknown, label: string) => {
    if (!period) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await apiClient.post(
        `/api/class-records/${workflowId}/periods/${code}/${action}`,
        { expectedRevision: period.revision, reason, ...(payload as object) },
      );
      setDialog(null);
      clearEdits();
      setReason("");
      await load();
      setNotice(
        label === "release"
          ? "Grades released. Each researcher can view only their own record."
          : "Saved privately. Release the period when it is ready for researchers.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const saveDrafts = () =>
    mode === "attendance"
      ? mutate("attendance", { entries: Object.values(markEdits) }, "save")
      : mutate(
          "scores",
          {
            entries: Object.values(scoreEdits).map((e) => ({
              ...e,
              score:
                e.state === "GRADED" && e.score !== "" ? Number(e.score) : null,
            })),
          },
          "save",
        );
  const openDialog = (kind: typeof dialog, ids?: string[]) => {
    if (dirty) {
      setError("Save your draft changes before continuing.");
      return;
    }
    setReleaseIds(ids);
    setError("");
    setForm(
      kind === "settings"
        ? {
            weighted: !!period?.weights,
            MILESTONE: period?.weights?.MILESTONE ?? 0,
            INDIVIDUAL: period?.weights?.INDIVIDUAL ?? 100,
            ATTENDANCE: period?.weights?.ATTENDANCE ?? 0,
            lateCredit: period?.lateCredit ?? 100,
            overallWeight: period?.overallWeight ?? "",
          }
        : {
            kind: "INDIVIDUAL",
            title: "",
            maxPoints: 100,
            taskId: "",
            date: new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Manila",
            }),
          },
    );
    setDialog(kind);
  };
  const filtered =
    period?.rows.filter((row) =>
      `${row.name} ${row.universityId} ${row.projects.map((p) => p.name).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];

  function exportRecord() {
    if (!period) return;
    const columns =
      mode === "attendance"
        ? period.sessions.map((s) => `${s.date} ${s.title}`)
        : period.items.map((i) => `${i.title} /${i.maxPoints}`);
    const lines = [
      [
        "Researcher",
        "University ID",
        "Group",
        ...columns,
        "Draft period (%)",
        "Last released (%)",
        "Released at",
      ],
      ...period.rows.map((row) => [
        row.name,
        row.universityId,
        row.projects.map((p) => p.name).join("; "),
        ...(mode === "attendance"
          ? row.attendance.map((a) =>
              a.status ? statusLabels[a.status] : "Unmarked",
            )
          : row.entries.map((e) => scoreText(e.score, e.maxPoints, e.state))),
        row.calculation.score ?? "",
        row.lastRelease?.snapshot.calculation.score ?? "",
        row.lastRelease?.releasedAt ?? "",
      ]),
    ];
    // Prevent spreadsheet formula execution in exported names and activity labels.
    const cell = (value: unknown) => {
      let s = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + lines.map((row) => row.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `class-record-${code.toLowerCase()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function attendanceSummary(snapshot: RecordSnapshot) {
    const a = snapshot.calculation.attendance;
    return `${a.present} present · ${a.absent} absent · ${a.late} late · ${a.excused} excused`;
  }

  return (
    <PageContainer maxWidth="full" className="class-record min-w-0">
      <PageHeader
        variant="plain"
        title={student ? "My Grades" : "Class Record"}
        category={student ? "YOUR ACADEMIC RECORD" : "COURSE WORKSPACE"}
        subtitle={
          student
            ? "Your released period grades, activities, and attendance."
            : "Individual grades and attendance, with linked research milestones."
        }
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw size={16} />}
            disabled={!!busy || loading || !workflowId}
            onClick={() => {
              if (allowSwitch()) {
                clearEdits();
                void load();
              }
            }}
          >
            Refresh
          </Button>
        }
      />
      {error && (
        <div role="alert" className="cr-alert cr-alert-error">
          {error}{" "}
          <button onClick={() => void load()} disabled={!!busy}>
            Reload record
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="cr-alert">
          {notice}
        </div>
      )}
      <div className="cr-toolbar cr-panel">
        <label className="cr-class-selector">
          Class / workflow
          <select
            aria-label="Class / workflow"
            data-guide={student ? "student-grade-context" : "co-class-select"}
              data-guide-empty={!student && !classes.length}
            data-tour="class-selection"
            value={workflowId}
            disabled={!!busy}
            onChange={(e) => chooseClass(e.target.value)}
          >
            {!classes.length && <option value="">No classes available</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.professor}
              </option>
            ))}
          </select>
        </label>
        <span className="cr-muted">
          {student ? (
            <>
              <ShieldCheck size={16} /> Only your released record is visible.
            </>
          ) : (
            <>
              <BookOpen size={16} /> Drafts are private to the class professor.
            </>
          )}
        </span>
      </div>
      {loading ? (
        <div className="cr-panel cr-empty" role="status">
          Loading class record…
        </div>
      ) : !workflowId ? (
        <div className="cr-panel cr-empty">
          {student
            ? "Join a class workflow to receive your grades here."
            : "Create a workflow and enroll researchers to start a class record."}
        </div>
      ) : !student && !record?.periods.length ? (
        <div className="cr-panel cr-empty">
          <BookOpen size={32} />
          <h2>Set up this class record</h2>
          <p>
            Create Prelim, Midterm, and Finals records for this workflow’s
            enrolled researchers.
          </p>
          <Button
            disabled={!!busy}
            onClick={async () => {
              setBusy("initialize");
              try {
                await apiClient.post(
                  `/api/class-records/${workflowId}/initialize`,
                  {},
                );
                await load();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy("");
              }
            }}
          >
            Create class record
          </Button>
        </div>
      ) : (
        <>
          <div
            className="cr-period-tabs"
            role="tablist"
            aria-label="Grading period"
          >
            {recordPeriods.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={p === code}
                disabled={!!busy}
                onClick={() => changeTab(p)}
              >
                {periodLabels[p]}
                {student &&
                  mine?.periods.find((x) => x.code === p)?.release && (
                    <span className="cr-dot" />
                  )}
              </button>
            ))}
          </div>
          {student ? (
            <>
              <div className="cr-summary">
                <div className="cr-panel">
                  <span>{periodLabels[code]} grade</span>
                  <strong>
                    {percentage(released?.snapshot.calculation.score)}
                  </strong>
                  <small>
                    {released
                      ? `Released ${formatReviewDateTime(released.releasedAt)}`
                      : "Not released yet"}
                  </small>
                </div>
                <div className="cr-panel">
                  <span>Attendance</span>
                  <strong>
                    {released
                      ? `${released.snapshot.calculation.attendance.present + released.snapshot.calculation.attendance.late} attended`
                      : "—"}
                  </strong>
                  <small>
                    {released
                      ? attendanceSummary(released.snapshot)
                      : "Available when your professor releases this period"}
                  </small>
                </div>
                <div className="cr-panel">
                  <span>Overall grade</span>
                  <strong>{percentage(mine?.overall)}</strong>
                  <small>
                    Available after all three periods are released with weights
                    totaling 100%.
                  </small>
                </div>
              </div>
              {!released ? (
                <div className="cr-panel cr-empty">
                  <ShieldCheck size={30} />
                  <h2>{periodLabels[code]} grades are not released yet</h2>
                  <p>
                    Your professor’s drafts stay private. Your published record
                    will appear here.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="cr-subtabs"
                    role="group"
                    aria-label="Record view"
                  >
                    {[
                      ["grades", "Activities"],
                      ["attendance", "Attendance"],
                      ["history", "Release history"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={mode === id}
                        onClick={() => setMode(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {mode === "grades" ? (
                    <div className="cr-panel">
                      <div className="cr-section-heading">
                        <h2>{periodLabels[code]} activity breakdown</h2>
                        <span className="cr-muted">
                          Released by {released.releasedByName}
                        </span>
                      </div>
                      <div className="cr-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Activity</th>
                              <th>Type</th>
                              <th>Released score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {released.snapshot.entries.map((e) => (
                              <tr key={e.itemId}>
                                <td>{e.title}</td>
                                <td>
                                  {e.kind === "MILESTONE"
                                    ? "Group milestone"
                                    : "Individual"}
                                </td>
                                <td>
                                  {scoreText(e.score, e.maxPoints, e.state)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <PolicyNote snapshot={released.snapshot} />
                    </div>
                  ) : mode === "attendance" ? (
                    <div className="cr-panel">
                      <div className="cr-section-heading">
                        <h2>Released attendance</h2>
                        <span className="cr-muted">
                          {attendanceSummary(released.snapshot)}
                        </span>
                      </div>
                      <div className="cr-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Session</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {released.snapshot.attendance.map((a) => (
                              <tr key={a.sessionId}>
                                <td>{dateLabel(a.date)}</td>
                                <td>{a.title}</td>
                                <td>
                                  <span
                                    className={`cr-attendance-status cr-status-${a.status?.toLowerCase()}`}
                                  >
                                    {a.status
                                      ? statusLabels[a.status]
                                      : "Unmarked"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!released.snapshot.attendance.length && (
                          <p className="cr-empty">
                            No attendance dates in this release.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <ReleaseHistory mine={mine!} />
                  )}
                  {released.snapshot.reason && (
                    <p className="cr-muted">
                      Professor’s release note: {released.snapshot.reason}
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            period && (
              <>
                <div className="cr-summary">
                  <div className="cr-panel">
                    <span>Enrolled researchers</span>
                    <strong>{period.rows.length}</strong>
                    <small>One row per active researcher</small>
                  </div>
                  <div className="cr-panel">
                    <span>{periodLabels[code]} released</span>
                    <strong>
                      {period.rows.filter((r) => r.lastRelease).length} /{" "}
                      {period.rows.length}
                    </strong>
                    <small>Researchers see their most recent release</small>
                  </div>
                  <div className="cr-panel">
                    <span>Grading method</span>
                    <strong className="cr-method">
                      {period.weights ? "Weighted categories" : "Total points"}
                    </strong>
                    <small>
                      {period.weights
                        ? `Milestones ${period.weights.MILESTONE}% · Individual ${period.weights.INDIVIDUAL}% · Attendance ${period.weights.ATTENDANCE}%`
                        : "Attendance is recorded separately"}
                    </small>
                  </div>
                </div>
                <div className="cr-toolbar">
                  <div
                    className="cr-subtabs"
                    role="group"
                    aria-label="Record view"
                  >
                    <button
                      data-guide="co-grade-tab"
                      aria-pressed={mode === "grades"}
                      disabled={!!busy}
                      onClick={() => changeTab(code, "grades")}
                    >
                      <BookOpen size={15} /> Grades
                    </button>
                    <button
                      data-guide="co-attendance-tab"
                      aria-pressed={mode === "attendance"}
                      disabled={!!busy}
                      onClick={() => changeTab(code, "attendance")}
                    >
                      <CalendarCheck size={15} /> Attendance
                    </button>
                    <button
                      data-orientation="class-history"
                      aria-pressed={mode === "history"}
                      disabled={!!busy}
                      onClick={() => changeTab(code, "history")}
                    >
                      <History size={15} /> History
                    </button>
                  </div>
                  <div className="cr-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy || !!dirty}
                      icon={<Settings2 size={15} />}
                      onClick={() => openDialog("settings")}
                    >
                      Grading settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy || !!dirty || mode === "history"}
                      icon={<Download size={15} />}
                      onClick={exportRecord}
                    >
                      Export CSV
                    </Button>
                  </div>
                </div>
                <div className="cr-panel">
                  <div className="cr-section-heading">
                    <div>
                      <h2>
                        {periodLabels[code]}{" "}
                        {mode === "attendance"
                          ? "attendance"
                          : mode === "history"
                            ? "history"
                            : "grade sheet"}
                      </h2>
                      <p>
                        {mode === "grades"
                          ? "Linked milestones use the released grade of the current submission. Save drafts to update totals."
                          : mode === "attendance"
                            ? "Record each researcher’s attendance by date. Excused dates are excluded from attendance calculations."
                            : "Saved changes and releases, with dates and correction notes. Times shown in Philippine time."}
                      </p>
                    </div>
                    {mode !== "history" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busy || !!dirty}
                        icon={<Plus size={15} />}
                        onClick={() =>
                          openDialog(mode === "attendance" ? "session" : "item")
                        }
                      >
                        {mode === "attendance"
                          ? "Add attendance date"
                          : "Add activity"}
                      </Button>
                    )}
                  </div>
                  {mode === "history" ? (
                    <div className="cr-history">
                      {record.history.map((event) => (
                        <div key={event.id}>
                          <strong>{historyLabel(event.eventType)}</strong>
                          <span>
                            {event.newValues.period
                              ? `${periodLabels[event.newValues.period]} · `
                              : ""}
                            {event.newValues.actorName || "Course professor"} ·{" "}
                            {formatReviewDateTime(event.createdAt)}
                          </span>
                          {event.newValues.reason && (
                            <p>{event.newValues.reason}</p>
                          )}
                          {historyDetail(event.newValues) && (
                            <p>{historyDetail(event.newValues)}</p>
                          )}
                        </div>
                      ))}
                      {!record.history.length && <p>No changes recorded.</p>}
                    </div>
                  ) : (
                    <>
                      <div className="cr-grid-tools">
                        <input
                          aria-label="Find researcher"
                          placeholder="Find researcher, ID, or group…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <span className="cr-muted">
                          {filtered.length} of {period.rows.length} researchers
                        </span>
                      </div>
                      <div
                        className="cr-table-scroll"
                        tabIndex={0}
                        aria-label={`${periodLabels[code]} ${mode} sheet`}
                      >
                        <table className="cr-sheet">
                          <thead>
                            <tr>
                              <th className="cr-student-col">Researcher</th>
                              {mode === "grades"
                                ? period.items.map((item) => (
                                    <th key={item.id}>
                                      <span>{item.title}</span>
                                      <small>
                                        {item.kind === "MILESTONE"
                                          ? "Linked group milestone"
                                          : "Individual activity"}{" "}
                                        · /{item.maxPoints}
                                      </small>
                                    </th>
                                  ))
                                : period.sessions.map((s) => (
                                    <th key={s.id}>
                                      <span>{dateLabel(s.date)}</span>
                                      <small>{s.title}</small>
                                    </th>
                                  ))}
                              <th>
                                {mode === "grades"
                                  ? "Draft grade"
                                  : "Attendance summary"}
                              </th>
                              <th>Last released</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((row) => (
                              <tr key={row.id}>
                                <th scope="row" className="cr-student-col">
                                  <span>{row.name}</span>
                                  <small>{row.universityId}</small>
                                  <small>
                                    {row.projects
                                      .map((p) => p.name)
                                      .join(" · ") || "No research group yet"}
                                  </small>
                                </th>
                                {mode === "grades"
                                  ? row.entries.map((entry) => {
                                      if (entry.kind === "MILESTONE")
                                        return (
                                          <td key={entry.itemId}>
                                            <strong>
                                              {scoreText(
                                                entry.score,
                                                entry.maxPoints,
                                                entry.state,
                                              )}
                                            </strong>
                                            {entry.source ? (
                                              <a
                                                href={`/professor/dashboard?tab=submissions&submissionId=${entry.source.submissionId}`}
                                                className="cr-review-link"
                                              >
                                                View submission
                                              </a>
                                            ) : (
                                              <small>{entry.sourceNote}</small>
                                            )}
                                          </td>
                                        );
                                      const key = `${row.id}:${entry.itemId}`;
                                      const edit = scoreEdits[key] || {
                                        itemId: entry.itemId,
                                        studentId: row.id,
                                        state: entry.state,
                                        score:
                                          entry.score === null
                                            ? ""
                                            : String(entry.score),
                                      };
                                      const update = (
                                        patch: Partial<ScoreEdit>,
                                      ) =>
                                        setScoreEdits((old) => ({
                                          ...old,
                                          [key]: { ...edit, ...patch },
                                        }));
                                      return (
                                        <td key={entry.itemId}>
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            max={entry.maxPoints}
                                            step="0.01"
                                            aria-label={`${row.name}: ${entry.title} score`}
                                            value={
                                              edit.state === "GRADED"
                                                ? edit.score
                                                : ""
                                            }
                                            placeholder={
                                              edit.state === "EXCUSED"
                                                ? "Excused"
                                                : edit.state === "MISSING"
                                                  ? "Missing"
                                                  : "—"
                                            }
                                            disabled={!!busy}
                                            onChange={(e) =>
                                              update({
                                                score: e.target.value,
                                                state:
                                                  e.target.value === ""
                                                    ? "UNGRADED"
                                                    : "GRADED",
                                              })
                                            }
                                          />
                                          <select
                                            aria-label={`${row.name}: ${entry.title} status`}
                                            value={edit.state}
                                            disabled={!!busy}
                                            onChange={(e) =>
                                              update({
                                                state: e.target.value,
                                                score:
                                                  e.target.value === "GRADED"
                                                    ? edit.score
                                                    : "",
                                              })
                                            }
                                          >
                                            <option value="UNGRADED">
                                              Ungraded
                                            </option>
                                            <option value="GRADED">
                                              Graded
                                            </option>
                                            <option value="MISSING">
                                              Missing (0)
                                            </option>
                                            <option value="EXCUSED">
                                              Excused
                                            </option>
                                          </select>
                                        </td>
                                      );
                                    })
                                  : row.attendance.map((a) => {
                                      const key = `${row.id}:${a.sessionId}`;
                                      return (
                                        <td key={a.sessionId}>
                                          <select
                                            aria-label={`${row.name}: ${a.date} attendance`}
                                            value={
                                              (key in markEdits
                                                ? markEdits[key].status
                                                : a.status) ?? ""
                                            }
                                            disabled={!!busy}
                                            onChange={(e) =>
                                              setMarkEdits((old) => ({
                                                ...old,
                                                [key]: {
                                                  sessionId: a.sessionId,
                                                  studentId: row.id,
                                                  status:
                                                    e.target.value || null,
                                                },
                                              }))
                                            }
                                          >
                                            <option value="">Unmarked</option>
                                            {Object.entries(statusLabels).map(
                                              ([value, label]) => (
                                                <option
                                                  key={value}
                                                  value={value}
                                                >
                                                  {label}
                                                </option>
                                              ),
                                            )}
                                          </select>
                                        </td>
                                      );
                                    })}
                                <td>
                                  {mode === "grades" ? (
                                    <>
                                      <strong className="cr-result">
                                        {percentage(row.calculation.score)}
                                      </strong>
                                      <small>
                                        {row.calculation.complete
                                          ? "Ready to release"
                                          : `${row.calculation.graded}/${row.calculation.activityCount} activities · ${row.calculation.attendance.unmarked} attendance unmarked`}
                                      </small>
                                    </>
                                  ) : (
                                    <>
                                      <strong>
                                        {row.calculation.attendance.present} P ·{" "}
                                        {row.calculation.attendance.absent} A ·{" "}
                                        {row.calculation.attendance.late} L
                                      </strong>
                                      <small>
                                        {row.calculation.attendance.excused}{" "}
                                        excused ·{" "}
                                        {row.calculation.attendance.unmarked}{" "}
                                        unmarked
                                      </small>
                                    </>
                                  )}
                                </td>
                                <td>
                                  <strong>
                                    {percentage(
                                      row.lastRelease?.snapshot.calculation
                                        .score,
                                    )}
                                  </strong>
                                  <small>
                                    {row.lastRelease
                                      ? formatReviewDateTime(
                                          row.lastRelease.releasedAt,
                                        )
                                      : "Not released"}
                                  </small>
                                </td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      !!busy ||
                                      !!dirty ||
                                      !row.calculation.complete
                                    }
                                    onClick={() =>
                                      openDialog("release", [row.id])
                                    }
                                  >
                                    Release
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!filtered.length && (
                        <p className="cr-empty">
                          {period.rows.length
                            ? "No researchers match your search."
                            : "No active researchers are enrolled in this workflow yet."}
                        </p>
                      )}
                      <div className="cr-save-bar">
                        <label>
                          Correction / release note
                          <input
                            aria-label="Correction or release note"
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Required for corrections or another release"
                            disabled={!!busy}
                          />
                        </label>
                        <div className="cr-actions">
                          <span className="cr-muted">
                            {dirty
                              ? `${dirty} unsaved change${dirty === 1 ? "" : "s"}`
                              : "All draft changes saved"}
                          </span>
                          <Button
                            variant="outline"
                            disabled={!!busy || !dirty}
                            isLoading={busy === "save"}
                            onClick={() => void saveDrafts()}
                          >
                            Save drafts
                          </Button>
                          <Button
                            disabled={
                              !!busy ||
                              !!dirty ||
                              !period.rows.length ||
                              period.rows.some((r) => !r.calculation.complete)
                            }
                            data-guide="co-release-period"
                            onClick={() => openDialog("release")}
                          >
                            Release period
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {mode !== "history" && (
                  <p className="cr-muted">
                    Release requires a score, Missing, or Excused for every
                    activity and a status for every attendance date. New edits
                    do not change an earlier release.
                  </p>
                )}
              </>
            )
          )}
        </>
      )}

      <Modal
        isOpen={dialog !== null}
        onClose={() => {
          if (!busy) setDialog(null);
        }}
        title={
          dialog === "item"
            ? "Add graded activity"
            : dialog === "session"
              ? "Add attendance date"
              : dialog === "settings"
                ? `${periodLabels[code]} grading settings`
                : "Release period grades"
        }
        footer={
          <>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={!!busy}
              isLoading={!!busy}
              onClick={() => {
                if (dialog === "item")
                  void mutate(
                    "items",
                    {
                      title: form.title,
                      kind: form.kind,
                      maxPoints: Number(form.maxPoints),
                      taskId: form.kind === "MILESTONE" ? form.taskId : null,
                    },
                    "activity",
                  );
                if (dialog === "session")
                  void mutate(
                    "sessions",
                    { title: form.title, date: form.date },
                    "session",
                  );
                if (dialog === "settings")
                  void mutate(
                    "settings",
                    {
                      weights: form.weighted
                        ? {
                            MILESTONE: Number(form.MILESTONE),
                            INDIVIDUAL: Number(form.INDIVIDUAL),
                            ATTENDANCE: Number(form.ATTENDANCE),
                          }
                        : null,
                      lateCredit: Number(form.lateCredit),
                      overallWeight:
                        form.overallWeight === ""
                          ? null
                          : Number(form.overallWeight),
                    },
                    "settings",
                  );
                if (dialog === "release")
                  void mutate(
                    "release",
                    {
                      expectedSourceToken: period?.sourceToken,
                      studentIds: releaseIds,
                    },
                    "release",
                  );
              }}
            >
              {dialog === "release" ? "Release grades" : "Save"}
            </Button>
          </>
        }
      >
        {dialog === "release" ? (
          <div className="cr-form">
            <p>
              Release the saved {periodLabels[code]} record for{" "}
              <strong>
                {releaseIds?.length ?? period?.rows.length} researcher(s)
              </strong>
              . Each researcher will see their own activity scores and
              attendance.
            </p>
            <div className="cr-release-preview">
              {period?.rows
                .filter((r) => !releaseIds || releaseIds.includes(r.id))
                .map((r) => (
                  <div key={r.id}>
                    <span>{r.name}</span>
                    <strong>{percentage(r.calculation.score)}</strong>
                  </div>
                ))}
            </div>
            <label>
              Release note
              <input
                aria-label="Release note"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Required when releasing a correction"
              />
            </label>
          </div>
        ) : dialog === "settings" ? (
          <div className="cr-form">
            <label>
              Grade calculation
              <select
                aria-label="Grade calculation"
                value={form.weighted ? "weighted" : "points"}
                onChange={(e) =>
                  setForm({ ...form, weighted: e.target.value === "weighted" })
                }
              >
                <option value="points">
                  Total activity points (attendance recorded separately)
                </option>
                <option value="weighted">Weighted categories</option>
              </select>
            </label>
            {form.weighted && (
              <>
                <p>
                  Set your school-approved category weights. They must total
                  100%. Each category with a positive weight needs eligible
                  scores.
                </p>
                <div className="cr-form-grid">
                  {[
                    ["MILESTONE", "Group milestones (%)"],
                    ["INDIVIDUAL", "Individual activities (%)"],
                    ["ATTENDANCE", "Attendance (%)"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={label}
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Late attendance credit (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.lateCredit}
                    onChange={(e) =>
                      setForm({ ...form, lateCredit: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            <label>
              {periodLabels[code]} weight in the overall grade (%)
              <input
                type="number"
                min={0}
                max={100}
                aria-label="Period weight"
                value={form.overallWeight}
                placeholder="Optional"
                onChange={(e) =>
                  setForm({ ...form, overallWeight: e.target.value })
                }
              />
            </label>
            <p>
              Overall grades appear after all three released period weights
              total 100%. Settings are saved with each release.
            </p>
            <label>
              Correction note
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Required after grades have been released"
              />
            </label>
          </div>
        ) : (
          <div className="cr-form">
            {dialog === "item" && (
              <label>
                Activity type
                <select
                  aria-label="Activity type"
                  value={form.kind}
                  onChange={(e) =>
                    setForm({ ...form, kind: e.target.value, taskId: "" })
                  }
                >
                  <option value="INDIVIDUAL">Individual activity</option>
                  <option value="MILESTONE">
                    Link a graded milestone requirement
                  </option>
                </select>
              </label>
            )}
            {dialog === "item" && form.kind === "MILESTONE" && (
              <label>
                Requirement
                <select
                  aria-label="Requirement"
                  value={form.taskId}
                  onChange={(e) => {
                    const task = record?.availableTasks.find(
                      (t) => t.id === e.target.value,
                    );
                    setForm({
                      ...form,
                      taskId: e.target.value,
                      title: task?.title || "",
                      maxPoints: task?.maxPoints || 100,
                    });
                  }}
                >
                  <option value="">Choose a requirement</option>
                  {record?.availableTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.stage.name} · {t.title} (/{t.maxPoints})
                    </option>
                  ))}
                </select>
                <small>
                  Only graded requirements not already linked to a period are
                  listed.
                </small>
              </label>
            )}
            <label>
              {dialog === "session" ? "Session title" : "Activity title"}
              <input
                aria-label={
                  dialog === "session" ? "Session title" : "Activity title"
                }
                value={form.title || ""}
                maxLength={150}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            {dialog === "session" ? (
              <label>
                Date
                <input
                  aria-label="Attendance date"
                  type="date"
                  value={form.date || ""}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
            ) : (
              <label>
                Maximum points
                <input
                  aria-label="Maximum points"
                  type="number"
                  min={1}
                  max={10000}
                  value={form.maxPoints || ""}
                  disabled={form.kind === "MILESTONE"}
                  onChange={(e) =>
                    setForm({ ...form, maxPoints: e.target.value })
                  }
                />
              </label>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="cr-alert cr-alert-error">
            {error}
          </p>
        )}
      </Modal>
    </PageContainer>
  );
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value + "T00:00:00.000Z"));
}
function historyLabel(value: string) {
  return value
    .replace(/^CLASS_RECORD_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (s) => s.toUpperCase());
}
function historyDetail(value: TeacherRecord["history"][number]["newValues"]) {
  if (value.activityTitle)
    return `${value.studentName} · ${value.activityTitle}: ${value.oldState === "GRADED" ? value.oldScore : value.oldState} → ${value.newState === "GRADED" ? value.newScore : value.newState}`;
  if (value.sessionTitle)
    return `${value.studentName} · ${value.date}: ${value.previousStatus || "Unmarked"} → ${value.status || "Unmarked"}`;
  if (value.studentName && typeof value.score === "number")
    return `${value.studentName} · ${percentage(value.score)}`;
  return "";
}
function PolicyNote({ snapshot }: { snapshot: RecordSnapshot }) {
  return (
    <p className="cr-policy">
      {snapshot.weights
        ? `Weighted categories: group milestones ${snapshot.weights.MILESTONE}%, individual activities ${snapshot.weights.INDIVIDUAL}%, attendance ${snapshot.weights.ATTENDANCE}%.`
        : "Calculated from total earned activity points divided by total possible activity points. Attendance is recorded separately."}{" "}
      Excused activities and dates are excluded.
      {snapshot.weights && snapshot.weights.ATTENDANCE > 0
        ? ` Late attendance earns ${snapshot.lateCredit}% credit.`
        : ""}
    </p>
  );
}
function ReleaseHistory({ mine }: { mine: StudentRecord }) {
  return (
    <div className="cr-panel cr-history">
      {mine.history.map((r) => (
        <div key={r.id}>
          <strong>
            {periodLabels[r.period]} · {percentage(r.score)}
          </strong>
          <span>
            {formatReviewDateTime(r.releasedAt)} · {r.releasedByName}
          </span>
        </div>
      ))}
    </div>
  );
}
