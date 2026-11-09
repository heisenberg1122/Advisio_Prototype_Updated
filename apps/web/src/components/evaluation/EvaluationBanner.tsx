import {
  beginEvaluationIdentityChange,
  cancelEvaluationIdentityChange,
} from "@/lib/evaluation-identity";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  GripVertical,
  Info,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  clearEvaluation,
  evaluationRequest,
  type EvaluationSession,
} from "./evaluation-client";
import {
  readProgress,
  saveProgress,
  type EvaluationProgress,
} from "./evaluation-progress";
import { EvaluationSteps, EvaluationSupport } from "./EvaluationShared";

function bannerInsets(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  return {
    right: document.documentElement.clientWidth - bounds.right,
    bottom: document.documentElement.clientHeight - bounds.bottom,
  };
}

export function EvaluationBanner() {
  const location = useLocation();
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [progress, setProgress] = useState<EvaluationProgress>({
    phase: "activities",
    checked: [],
  });
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<{
    right?: number;
    bottom: number;
  }>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const banner = useRef<HTMLElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    right: number;
    bottom: number;
    moved: boolean;
  } | null>(null);
  const suppressToggleClick = useRef(false);
  const collapseToggle = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const endTrigger = useRef<HTMLButtonElement>(null);
  const endConfirmation = useRef<HTMLDivElement>(null);
  const active = localStorage.getItem("advisio_token") === "__evaluation__";
  useEffect(() => {
    const element = banner.current;
    if (!element) return;
    const measure = () => {
      const height = `${element.offsetHeight}px`;
      element.style.setProperty(
        "--evaluation-banner-width",
        `${element.offsetWidth}px`,
      );
      element.style.setProperty("--evaluation-banner-height", height);
      if (!collapsed) {
        document.documentElement.style.setProperty(
          "--evaluation-controls-height",
          height,
        );
      }
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      document.documentElement.style.removeProperty(
        "--evaluation-controls-height",
      );
    };
  }, [active, collapsed, session, location.pathname]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("advisio:evaluation-activities", show);
    return () =>
      window.removeEventListener("advisio:evaluation-activities", show);
  }, []);
  useEffect(() => {
    if (!active) return;
    let current = true;
    evaluationRequest<EvaluationSession>("session")
      .then((value) => {
        if (current) {
          setSession(value);
          setProgress(
            readProgress(
              value.progressKey || value.projectId,
              value.tasks.length,
            ),
          );
        }
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [active]);
  useEffect(() => {
    setOpen(false);
    setConfirmEnd(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmEnd(false);
        (collapsed ? collapseToggle : trigger).current?.focus();
      }
      if (event.key !== "Tab") return;
      const items = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],input:not([disabled])",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", listener);
    };
  }, [collapsed, open, progress.phase]);
  useEffect(() => {
    if (open && confirmEnd) endConfirmation.current?.focus();
  }, [open, confirmEnd]);
  if (!active || !session || location.pathname.startsWith("/evaluate"))
    return null;
  const completed = progress.phase === "complete";
  function moveBanner(right: number, bottom: number) {
    const element = banner.current!;
    const viewport = document.documentElement;
    setPosition((previous) => ({
      right: collapsed
        ? previous?.right
        : Math.max(
            0,
            Math.min(right, viewport.clientWidth - element.offsetWidth),
          ),
      bottom: Math.max(
        0,
        Math.min(bottom, viewport.clientHeight - element.offsetHeight),
      ),
    }));
  }
  const moveHandle: React.HTMLAttributes<HTMLButtonElement> = {
    onPointerDown(event) {
      if (!event.isPrimary || event.button !== 0 || drag.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      suppressToggleClick.current = false;
      drag.current = {
        ...bannerInsets(banner.current!),
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
    },
    onPointerMove(event) {
      const start = drag.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const dx = collapsed ? 0 : event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 5) return;
      start.moved = true;
      suppressToggleClick.current = collapsed;
      moveBanner(start.right - dx, start.bottom - dy);
    },
    onLostPointerCapture(event) {
      if (drag.current?.pointerId === event.pointerId) drag.current = null;
    },
    onKeyDown(event) {
      const horizontal =
        event.key === "ArrowLeft" ? 24 : event.key === "ArrowRight" ? -24 : 0;
      const vertical =
        event.key === "ArrowUp" ? 24 : event.key === "ArrowDown" ? -24 : 0;
      if (!(vertical || (!collapsed && horizontal))) return;
      event.preventDefault();
      const { right, bottom } = bannerInsets(banner.current!);
      moveBanner(right + horizontal, bottom + vertical);
    },
  };
  function update(next: EvaluationProgress) {
    setProgress(next);
    saveProgress(session!.progressKey || session!.projectId, next);
  }
  function toggle(index: number) {
    update({
      ...progress,
      checked: progress.checked.includes(index)
        ? progress.checked.filter((n) => n !== index)
        : [...progress.checked, index],
    });
  }
  function close() {
    setOpen(false);
    setConfirmEnd(false);
    (collapsed ? collapseToggle : trigger).current?.focus();
  }
  async function end() {
    setBusy(true);
    setError("");
    try {
      await evaluationRequest("end", { method: "POST" });
      clearEvaluation(session?.progressKey || session?.projectId);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function switchRole(role: string) {
    if (!session || role === session.role || busy) return;
    setBusy(true);
    setError("");
    beginEvaluationIdentityChange();
    try {
      const switched = await evaluationRequest<EvaluationSession>(
        "switch-role",
        {
          method: "POST",
          body: JSON.stringify({ role }),
        },
      );
      // Reload clears cached queries and renders the actual portal for the new identity.
      window.location.assign(switched.home);
    } catch (e) {
      cancelEvaluationIdentityChange();
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function switchScenario(scenario: string) {
    if (!session || scenario === session.scenario || busy) return;
    setBusy(true);
    setError("");
    beginEvaluationIdentityChange();
    try {
      const switched = await evaluationRequest<EvaluationSession>(
        "switch-scenario",
        { method: "POST", body: JSON.stringify({ scenario }) },
      );
      window.location.assign(switched.home);
    } catch (e) {
      cancelEvaluationIdentityChange();
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <aside
        ref={banner}
        className={`evaluation-banner${collapsed ? " is-collapsed" : ""}`}
        style={
          {
            "--evaluation-banner-right":
              position?.right === undefined ? undefined : `${position.right}px`,
            "--evaluation-banner-bottom": position
              ? `${position.bottom}px`
              : undefined,
          } as React.CSSProperties
        }
        aria-label="Evaluation controls"
      >
        <div
          id="evaluation-banner-controls"
          className="evaluation-banner-controls"
          hidden={collapsed}
        >
          <span>
            <strong>Step {completed ? 3 : 2} of 3</strong>
            <small>
              {session.roleLabel} · {session.collegeCode || session.college}
            </small>
          </span>
          {!!session.roles?.length && (
            <label className="evaluation-role-switcher">
              <span>Demo role</span>
              <select
                aria-label="Switch demo role"
                value={session.role}
                disabled={busy}
                onChange={(e) => void switchRole(e.target.value)}
              >
                {session.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!!session.scenarios?.length && (
            <label className="evaluation-role-switcher">
              <span>Demo scenario</span>
              <select
                aria-label="Switch demo scenario"
                value={session.scenario || ""}
                disabled={busy}
                onChange={(e) => void switchScenario(e.target.value)}
              >
                {session.scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            ref={trigger}
            onClick={() => {
              setProgress(
                readProgress(
                  session.progressKey || session.projectId,
                  session.tasks.length,
                ),
              );
              setOpen(true);
            }}
          >
            Evaluation activities
          </button>
        </div>
        <div className="evaluation-banner-actions">
          {!collapsed && (
            <button
              {...moveHandle}
              type="button"
              className="evaluation-banner-toggle evaluation-banner-grip"
              aria-label="Move evaluation controls with arrow keys"
              title="Drag or use arrow keys to move the evaluation controls"
            >
              <GripVertical size={18} aria-hidden="true" />
            </button>
          )}
          <button
            {...(collapsed ? moveHandle : {})}
            ref={collapseToggle}
            type="button"
            className="evaluation-banner-toggle"
            aria-label={
              collapsed
                ? "Expand evaluation controls"
                : "Collapse evaluation controls"
            }
            aria-expanded={!collapsed}
            aria-controls="evaluation-banner-controls"
            title={
              collapsed
                ? "Open evaluation controls or drag to move"
                : "Collapse evaluation controls"
            }
            onPointerDown={(event) => {
              if (!event.isPrimary) return;
              suppressToggleClick.current = false;
              if (collapsed) moveHandle.onPointerDown?.(event);
            }}
            onPointerUp={(event) => {
              if (
                event.pointerType !== "touch" ||
                !event.isPrimary ||
                suppressToggleClick.current
              )
                return;
              const { left, right, top, bottom } =
                event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < left ||
                event.clientX > right ||
                event.clientY < top ||
                event.clientY > bottom
              )
                return;
              suppressToggleClick.current = true;
              setCollapsed(!collapsed);
            }}
            onClick={(event) => {
              if (event.detail === 0 || !suppressToggleClick.current) {
                setCollapsed(!collapsed);
              }
            }}
          >
            {collapsed ? (
              <>
                <ChevronLeft size={16} aria-hidden="true" />
                <span>Evaluation</span>
              </>
            ) : (
              <ChevronRight size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </aside>
      {error && !open && (
        <p className="evaluation-switch-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <div className="evaluation-overlay">
          <section
            className={`evaluation-dialog${completed ? " evaluation-completion" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="evaluation-guide-title"
            tabIndex={-1}
            ref={dialog}
          >
            <div
              className={
                completed
                  ? "evaluation-completion-header"
                  : "evaluation-actions"
              }
            >
              {completed && (
                <CircleCheck
                  className="evaluation-completion-icon"
                  size={26}
                  aria-hidden="true"
                />
              )}
              <h2 id="evaluation-guide-title">
                {completed
                  ? "You've completed the ADVISIO walkthrough!"
                  : "Explore ADVISIO"}
              </h2>
              <button
                className="secondary"
                onClick={close}
                aria-label="Close evaluation guide"
              >
                Close
              </button>
            </div>
            <EvaluationSteps current={completed ? 3 : 2} />
            {!completed ? (
              <>
                <p>
                  <strong>
                    {session.roleLabel} · {session.college}
                  </strong>
                  <br />
                  {session.title}
                  {session.scenarioLabel && (
                    <>
                      <br />
                      <small>Scenario: {session.scenarioLabel}</small>
                    </>
                  )}
                </p>
                <p>
                  Tick each activity as you try it. If you cannot complete one,
                  you can still describe what happened in Google Forms.
                </p>
                <p className="evaluation-help">
                  {progress.checked.length} of {session.tasks.length} activities
                  ticked
                </p>
                <ol className="evaluation-task-list">
                  {session.tasks.map((task, index) => (
                    <li key={task}>
                      <label>
                        <input
                          type="checkbox"
                          checked={progress.checked.includes(index)}
                          onChange={() => toggle(index)}
                        />
                        <span>{task}</span>
                      </label>
                    </li>
                  ))}
                </ol>
                {session.role === "student" &&
                  session.revisionAvailable !== false && (
                    <p>
                      <a
                        href="/api/evaluation/revision"
                        download={session.revisionName}
                      >
                        Download the prepared revision PDF
                      </a>
                    </p>
                  )}
                {session.role === "professor" &&
                  session.requestLetterAvailable !== false && (
                    <p>
                      <a href="/api/evaluation/request-letter" download>
                        Download the fictional Dean approval request letter
                      </a>
                    </p>
                  )}
                {session.signingPassword && (
                  <p className="evaluation-help">
                    For the fictional Dean signing activity, use the saved demo
                    signature and password:{" "}
                    <code>{session.signingPassword}</code>. This applies only to
                    this temporary demo account.
                  </p>
                )}
                <p>
                  Try the available features before answering. You may explore
                  beyond these activities and report any difficulties honestly.
                </p>
                <button
                  disabled={busy || confirmEnd}
                  onClick={() => update({ ...progress, phase: "complete" })}
                >
                  Finish walkthrough
                </button>
              </>
            ) : (
              <>
                <dl
                  className="evaluation-completion-summary"
                  aria-label="Demo summary"
                >
                  <div>
                    <dt>Role</dt>
                    <dd>{session.roleLabel}</dd>
                  </div>
                  <div>
                    <dt>College</dt>
                    <dd>{session.college}</dd>
                  </div>
                  <div>
                    <dt>Scenario</dt>
                    <dd>{session.scenarioLabel || session.title}</dd>
                  </div>
                </dl>
                <h3>Return to your original Google Forms tab</h3>
                <p>
                  Answer the remaining TAM statements based on your experience
                  using ADVISIO, then submit your response in Google Forms.
                </p>
                <p className="evaluation-help evaluation-completion-note">
                  <Info size={16} aria-hidden="true" />
                  <span>
                    Completing the demo does not automatically submit your
                    Google Form.
                  </span>
                </p>
              </>
            )}
            <EvaluationSupport />
            {error && (
              <p role="alert" className="evaluation-error">
                {error}
              </p>
            )}
            <div className="evaluation-actions evaluation-end">
              {completed && (
                <button
                  className="secondary"
                  disabled={busy || confirmEnd}
                  onClick={() => update({ ...progress, phase: "activities" })}
                >
                  Return to activity checklist
                </button>
              )}
              <button
                ref={endTrigger}
                className={completed ? undefined : "secondary"}
                disabled={busy}
                aria-expanded={confirmEnd}
                aria-controls={
                  confirmEnd ? "evaluation-end-confirmation" : undefined
                }
                onClick={() => {
                  setError("");
                  setConfirmEnd(!confirmEnd);
                }}
              >
                {busy ? "Closing…" : "End demo session"}
              </button>
            </div>
            {confirmEnd && (
              <div
                id="evaluation-end-confirmation"
                ref={endConfirmation}
                tabIndex={-1}
                role="group"
                aria-labelledby="evaluation-end-prompt"
              >
                <p id="evaluation-end-prompt">
                  End this demo session and clear its practice records?
                </p>
                <div className="evaluation-actions">
                  <button disabled={busy} onClick={end}>
                    End and clear workspace
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setConfirmEnd(false);
                      endTrigger.current?.focus();
                    }}
                  >
                    Keep working
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
