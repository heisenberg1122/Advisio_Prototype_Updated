import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Archive, FileText, Inbox, Pencil, Search, Send, Trash2 } from "lucide-react";
import type { MailThreadList } from "@/components/messaging/MailThreadList";
import type { MailCounts, MailThreadListResponse } from "@/components/messaging/mail-types";
import { ResearcherThreadRows } from "./ResearcherThreadRows";
import { isEmptyFolder, mergeObservation, observeFolder, type FolderObservation, type ResearcherMailFolder } from "./mailbox-presentation";
import { useAuth } from "@/hooks/use-auth";
import { getAcademicIdentity } from "@/lib/academic-identity";
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
  additionalFolders?: ReactNode;
};

const folders = [
  { id: "inbox", label: "Inbox", icon: Inbox, empty: "Your inbox is currently empty.", hint: "Letters from your adviser, panel or coordinator, like approvals and endorsements, arrive here." },
  { id: "sent", label: "Sent", icon: Send, empty: "Your sent folder is currently empty.", hint: "Messages you send appear here." },
  { id: "drafts", label: "Drafts", icon: FileText, empty: "Your drafts folder is currently empty.", hint: "Unsent messages are kept here until you send them." },
  { id: "archive", label: "Archive", icon: Archive, empty: "Your archive is currently empty.", hint: "Archive a conversation to keep it out of your inbox without deleting it." },
  { id: "trash", label: "Trash", icon: Trash2, empty: "Your trash is currently empty.", hint: "Deleted conversations stay here until they are cleared." },
] as const;

export function ResearcherInboxWorkspace(props: Props) {
  const { folder, data, resolvedQuery, filter, loading, errored, selectedId } = props;
  const { user } = useAuth();
  const seal = getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc;
  const [history, setHistory] = useState<Partial<Record<ResearcherMailFolder, FolderObservation>>>({});
  const [lastCounts, setLastCounts] = useState<MailCounts>();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previousSelection = useRef<string | undefined>(undefined);
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

  // Keep keyboard focus in the visible pane when switching list/reader views.
  useEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = selectedId;
    if (selectedId) {
      workspaceRef.current?.querySelector<HTMLElement>(".rm-reader")?.focus({ preventScroll: true });
    } else if (previous) {
      const row = Array.from(workspaceRef.current?.querySelectorAll<HTMLButtonElement>("[data-thread-id]") || [])
        .find(button => button.dataset.threadId === previous);
      row?.focus({ preventScroll: true });
    }
  }, [selectedId]);

  // A new search query can be pending without invalidating an already resolved
  // mailbox. Retain its presentation until fresh authoritative counts arrive.
  const initialLoading = loading && !previous;
  const empty = isEmptyFolder(resolved, selectedId, initialLoading, errored);
  const showReader = Boolean(selectedId || (resolved && resolved.count > 0) || errored);
  const currentFolder = folders.find(item => item.id === folder)!;
  const counts = data?.counts || lastCounts;
  const total = props.pagination?.total ?? 0;
  const status = total
    ? `${total} ${total === 1 ? "conversation" : "conversations"}${folder === "inbox" && counts?.unread ? ` · ${counts.unread} unread` : ""}`
    : folder === "inbox" ? "No messages yet" : `${currentFolder.label} is empty`;

  return (
    <div ref={workspaceRef} className="researcher-mail" data-empty={empty} data-selected={Boolean(selectedId)}>
      <header className="rm-band">
        {seal && <img className="rm-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
        <div className="rm-band-text">
          <p><strong>{currentFolder.label}</strong> · Formal academic correspondence</p>
          <h1>{status}</h1>
        </div>
        <button type="button" onClick={props.onCompose} className="rm-compose"><Pencil size={16} aria-hidden="true" />Compose</button>
      </header>
      <aside className="rm-navigation">
        <nav aria-label="Mail folders" className="rm-folders">
          {folders.map(item => {
            const count = item.id === "inbox" ? counts?.unread : counts?.[item.id];
            return <button key={item.id} type="button" onClick={() => props.onFolderChange(item.id)} aria-current={folder === item.id ? "page" : undefined}>
              <item.icon size={17} aria-hidden="true" /><span>{item.label}</span>
              {count ? <span className="rm-folder-count">{count}</span> : null}
            </button>;
          })}
          {props.additionalFolders}
        </nav>
        <p className="rm-note">Separate from group chats. Only authorized academic contacts can write here.</p>
      </aside>
      <div className="rm-content">
        <header className="rm-heading">
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
              {empty ? <div className="rm-empty"><span className="rm-empty-icon"><currentFolder.icon size={22} aria-hidden="true" /></span><h2>{currentFolder.empty}</h2><p>{currentFolder.hint}</p>{folder === "inbox" && !resolvedQuery ? <button type="button" className="rm-empty-action" onClick={props.onCompose}><Pencil size={15} aria-hidden="true" />Write a message</button> : null}</div> : errored && props.threads.length === 0 ? null : <ResearcherThreadRows {...props} />}
            </div>
          </section>
          <div className="rm-reader" tabIndex={-1} role="region" aria-label="Selected conversation">{props.reader}</div>
        </div>
      </div>
    </div>
  );
}
