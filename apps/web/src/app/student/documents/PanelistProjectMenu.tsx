import { useEffect, useId, useRef, useState } from "react";

type MenuProject = { id: string; title: string; groupName?: string | null };

/** Styled project switcher for the panelist Panel documents page (replaces the native select). */
export function PanelistProjectMenu({
  projects,
  activeProjectId,
  onSelect,
  guide,
  heading = "Your panel projects",
}: {
  projects: MenuProject[];
  activeProjectId: string;
  onSelect: (projectId: string) => void;
  guide?: string;
  heading?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    // Move focus to the current project so arrow keys and Tab start from there.
    rootRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"], .pd-menu-item')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const moveFocus = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>(".pd-menu-item") ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
    items[next]?.focus();
  };

  return (
    <div ref={rootRef} className="pd-menu-root">
      <button
        ref={triggerRef}
        type="button"
        className="pd-change"
        data-guide={guide}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="ti ti-arrows-exchange" aria-hidden="true" /> Change project
        <i className={`ti ti-chevron-${open ? "up" : "down"} pd-chevron`} aria-hidden="true" />
      </button>
      {open && (
        <div className="pd-menu" role="dialog" aria-label="Choose a research project">
          <p className="pd-menu-head">{heading}</p>
          <ul id={listId} onKeyDown={moveFocus}>
            {projects.map((project) => {
              const current = project.id === activeProjectId;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    className="pd-menu-item"
                    aria-current={current ? "true" : undefined}
                    onClick={() => {
                      setOpen(false);
                      if (!current) onSelect(project.id);
                    }}
                  >
                    <span className="pd-menu-text">
                      {project.groupName && <span className="pd-menu-group">{project.groupName}</span>}
                      <span className="pd-menu-title">{project.title || "Research title not registered"}</span>
                    </span>
                    {current && <i className="ti ti-check pd-menu-check" aria-label="Current project" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
