import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Archive, FileText, Inbox, Pencil, Search, Send, Trash2 } from "lucide-react";
import type { MailThreadList } from "@/components/messaging/MailThreadList";
import type { MailCounts, MailThreadListResponse } from "@/components/messaging/mail-types";
import { ResearcherThreadRows } from "./ResearcherThreadRows";
import { isEmptyFolder, mergeObservation, observeFolder, type FolderObservation, type ResearcherMailFolder } from "./mailbox-presentation";
import "./researcher-inbox.css";

type Props = ComponentProps<typeof MailThreadList> & {
  folder: ResearcherMailFolder;
  data?: MailThreadListResponse;
  resolvedQuery: string;
  errored: boolean;
  listError?: string;
  onCompose: () => void;
  onFolderChange: (folder: ResearcherMailFolder) => void;
  reader: ReactNode;
};

const folders = [
  { id: "inbox", label: "Inbox", icon: Inbox, empty: "Your inbox is currently empty." },
  { id: "sent", label: "Sent", icon: Send, empty: "Your sent folder is currently empty." },
  { id: "drafts", label: "Drafts", icon: FileText, empty: "Your drafts folder is currently empty." },
  { id: "archive", label: "Archive", icon: Archive, empty: "Your archive is currently empty." },
  { id: "trash", label: "Trash", icon: Trash2, empty: "Your trash is currently empty." },
] as const;

export function ResearcherInboxWorkspace(props: Props) {
  const { folder, data, resolvedQuery, filter, loading, errored, selectedId } = props;
  const [history, setHistory] = useState<Partial<Record<ResearcherMailFolder, FolderObservation>>>({});
  const [lastCounts, setLastCounts] = useState<MailCounts>();
  const previous = history[folder];
  const observation = errored ? undefined : observeFolder(folder, data, resolvedQuery, filter) ||
    (previous && data ? { ...previous, count: data.counts[folder] } : undefined);
  const resolved = observation ? mergeObservation(previous, observation) : previous;

  useEffect(() => {
    if (errored) return;
    const next = observeFolder(folder, data, resolvedQuery, filter);
    setHistory(current => {
      const observed = next || (current[folder] && data ? { ...current[folder], count: data.counts[folder] } : undefined);
      return observed ? { ...current, [folder]: mergeObservation(current[folder], observed) } : current;
    });
    if (data) setLastCounts(data.counts);
  }, [folder, data, resolvedQuery, filter, errored]);

  // A new search query can be pending without invalidating an already resolved
  // mailbox. Retain its presentation until fresh authoritative counts arrive.
  const initialLoading = loading && !previous;
  const empty = isEmptyFolder(resolved, selectedId, initialLoading, errored);
  const showReader = Boolean(selectedId || (resolved && resolved.count > 0) || errored);
  const currentFolder = folders.find(item => item.id === folder)!;
  const counts = data?.counts || lastCounts;

  return (
    <div className="researcher-mail" data-empty={empty} data-selected={Boolean(selectedId)}>
      <aside className="rm-navigation">
        <button type="button" onClick={props.onCompose} className="rm-compose"><Pencil size={16} aria-hidden="true" />Compose</button>
        <nav aria-label="Mail folders" className="rm-folders">
          {folders.map(item => {
            const count = item.id === "inbox" ? counts?.unread : counts?.[item.id];
            return <button key={item.id} type="button" onClick={() => props.onFolderChange(item.id)} aria-current={folder === item.id ? "page" : undefined}>
              <item.icon size={17} aria-hidden="true" /><span>{item.label}</span>
              {count ? <span className="rm-folder-count">{count}</span> : null}
            </button>;
          })}
        </nav>
        <div className="rm-note"><p>Formal correspondence</p><p>Inbox is separate from project group chats and uses authorized academic contacts only.</p></div>
      </aside>
      <div className="rm-content">
        <header className="rm-heading">
          <div className="rm-title"><div><p>Academic correspondence</p><h1>{currentFolder.label}</h1></div><span>{props.pagination?.total ?? 0} {props.pagination?.total === 1 ? "thread" : "threads"}</span></div>
          <div className="rm-tools">
            <label className="rm-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search mail</span><input value={props.query} onChange={event => props.onQueryChange(event.target.value)} placeholder="Search sender, subject, or message" /></label>
            {folder !== "drafts" ? <div className="rm-filters" aria-label="Message filters">
              {(["all", "unread", "attachments"] as const).map(item => <button key={item} type="button" aria-pressed={filter === item} onClick={() => props.onFilterChange(item)}>{item}</button>)}
            </div> : null}
          </div>
        </header>
        <div className="rm-panes" data-reader={showReader}>
          <section className="rm-list" aria-label={`${currentFolder.label} message list`}>
            <div className="rm-list-scroll" aria-live="polite">
              {errored && props.listError ? <p role="alert" className="rm-list-error">{props.listError}</p> : null}
              {empty ? <div className="rm-empty"><currentFolder.icon size={28} aria-hidden="true" /><h2>{currentFolder.empty}</h2></div> : errored && props.threads.length === 0 ? null : <ResearcherThreadRows {...props} />}
            </div>
          </section>
          <div className="rm-reader">{props.reader}</div>
        </div>
      </div>
    </div>
  );
}
