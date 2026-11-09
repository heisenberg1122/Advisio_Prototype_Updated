import { useState, type CSSProperties } from "react";
import { SegmentedSwitch } from "@/components/ui/advisio";

type PickerProject = { id: string; title: string; groupName?: string | null };
type PickerView = "cards" | "list";

const VIEW_KEY = "advisio:adviser-project-picker-view";

// Storage can be blocked in private windows; the picker still works with the default view.
function readView(): PickerView {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

function saveView(view: PickerView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // The choice just won't be remembered.
  }
}

const groupInitial = (name: string) => {
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  return (last.length <= 2 ? last : words[0]?.[0] ?? "?").toUpperCase();
};

/** First screen on the adviser's Documents and Official Copies pages, before a group is chosen. */
export function AdviserProjectPicker({
  projects,
  onOpen,
  isOfficial,
  tabLabel,
  seal,
  unavailable,
  guide,
}: {
  projects: PickerProject[];
  onOpen: (projectId: string) => void;
  isOfficial: boolean;
  tabLabel: string;
  seal?: string;
  unavailable?: boolean;
  guide?: string;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PickerView>(readView);
  const term = search.trim().toLowerCase();
  const ordered = [...projects].sort((a, b) =>
    (a.groupName || a.title).localeCompare(b.groupName || b.title, undefined, { numeric: true, sensitivity: "base" }),
  );
  const visible = ordered.filter((project) => `${project.groupName || ""} ${project.title || ""}`.toLowerCase().includes(term));
  const showGuide = isOfficial && !term;
  // The how-to tile fills whatever is left of the last row, so the grid never ends with a hole.
  const leftoverWide = (3 - (visible.length % 3)) % 3;
  const leftoverMedium = visible.length % 2;

  return (
    <div className="pk">
      <section className="pd-hero phone-slim-picker" aria-labelledby="adviser-documents-title">
        {seal && (
          <span className="pd-hero-seal" aria-hidden="true">
            <img src={seal} alt="" draggable={false} />
          </span>
        )}
        <div className="pd-hero-top pk-hero-top">
          <div className="pd-hero-text" id="researcher-library-title" tabIndex={-1}>
            <p className="pd-hero-eyebrow">
              {tabLabel} · {projects.length} research {projects.length === 1 ? "group" : "groups"}
            </p>
            <h1 id="adviser-documents-title" className="pd-hero-title">
              Choose a research group
            </h1>
            <p className="pd-hero-summary">
              {isOfficial ? "Open a group to finalize approved versions and find its official records." : "Open a group to see its files, feedback, and milestones."}
            </p>
          </div>
          <label className="pk-find">
            <i className="ti ti-search" aria-hidden="true" />
            <span className="sr-only">Find a research group</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a group or title" />
          </label>
        </div>
      </section>

      {unavailable && (
        <p role="alert" className="pk-alert">
          <i className="ti ti-alert-triangle" aria-hidden="true" /> That project is unavailable or outside your assigned groups. Choose one below.
        </p>
      )}

      <div className="pk-tools">
        <SegmentedSwitch<PickerView>
          label="View"
          value={view}
          onChange={(next) => {
            setView(next);
            saveView(next);
          }}
          options={[
            { value: "cards", label: <><i className="ti ti-layout-grid" aria-hidden="true" /> Cards</> },
            { value: "list", label: <><i className="ti ti-list" aria-hidden="true" /> List</> },
          ]}
        />
      </div>

      {visible.length && view === "list" ? (
        <ul className="pk-list" data-guide={guide}>
          {visible.map((project) => {
            const name = project.groupName || "Research group";
            const title = project.title || "Research title not registered";
            return (
              <li key={project.id}>
                <button type="button" className="pk-row" aria-label={`Open ${name}: ${title}`} onClick={() => onOpen(project.id)}>
                  <span className="pk-row-badge" aria-hidden="true">{groupInitial(name)}</span>
                  <span className="pk-row-text">
                    <strong title={title}>{title}</strong>
                    <small>{name}</small>
                  </span>
                  <span className="pk-open">
                    {isOfficial ? "View records" : "Open group"}
                    <i className="ti ti-arrow-right" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : visible.length ? (
        <div className="pk-grid" data-guide={guide}>
          {visible.map((project) => {
            const name = project.groupName || "Research group";
            const title = project.title || "Research title not registered";
            const initial = groupInitial(name);
            return (
              <button key={project.id} type="button" className="pk-card" aria-label={`Open ${name}: ${title}`} onClick={() => onOpen(project.id)}>
                <span className="pk-band" aria-hidden="true">
                  <span className="pk-ghost">{initial}</span>
                  <span className="pk-badge">{initial}</span>
                </span>
                <span className="pk-body">
                  <small>{name}</small>
                  <strong title={title}>{title}</strong>
                  <span className="pk-open">
                    {isOfficial ? "View records" : "Open group"}
                    <i className="ti ti-arrow-right" aria-hidden="true" />
                  </span>
                </span>
              </button>
            );
          })}
          {showGuide && (
            <aside
              className="pk-howto"
              data-medium={leftoverMedium}
              data-wide={leftoverWide}
              style={{ "--pk-wide-span": leftoverWide } as CSSProperties}
              aria-label="How a copy becomes official"
            >
              <i className="ti ti-certificate pk-howto-ghost" aria-hidden="true" />
              <h2>How a copy becomes official</h2>
              <ol>
                <li>
                  <b>1</b>
                  <span>Approved version<small>Reviewed and locked</small></span>
                </li>
                <li>
                  <b>2</b>
                  <span>Finalize &amp; archive<small>Saved as the record</small></span>
                </li>
                <li>
                  <b>3</b>
                  <span>Add signature<small>Signed and verifiable</small></span>
                </li>
              </ol>
            </aside>
          )}
        </div>
      ) : (
        <div className="pk-none" role="status">
          <p>No group matches “{search.trim()}”.</p>
          <button type="button" onClick={() => setSearch("")}>Clear search</button>
        </div>
      )}
    </div>
  );
}
