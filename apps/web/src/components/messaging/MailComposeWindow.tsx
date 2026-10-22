import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Bold,
  Italic,
  List,
  Maximize2,
  Minimize2,
  Paperclip,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type {
  ComposeSeed,
  ComposeSubmission,
  MailContact,
} from "./mail-types";
import { personInitials, personName } from "./mail-types";

interface RecipientPickerProps {
  label: string;
  contacts: MailContact[];
  selectedIds: string[];
  unavailableIds: Set<string>;
  onChange: (ids: string[]) => void;
  required?: boolean;
}

function RecipientPicker({
  label,
  contacts,
  selectedIds,
  unavailableIds,
  onChange,
  required,
}: RecipientPickerProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const contactMap = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );
  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return contacts
      .filter(
        (contact) =>
          !selectedIds.includes(contact.id) &&
          !unavailableIds.has(contact.id) &&
          (!normalized ||
            `${personName(contact)} ${contact.email} ${contact.roles.join(" ")}`
              .toLowerCase()
              .includes(normalized)),
      )
      .slice(0, 8);
  }, [contacts, query, selectedIds, unavailableIds]);

  return (
    <div className="relative flex min-h-11 items-start gap-2 border-b border-[var(--color-border)] px-4 py-2">
      <label className="w-9 shrink-0 pt-1.5 text-xs font-bold text-[var(--color-text-muted)]">
        {label}{required ? <span className="sr-only"> required</span> : null}
      </label>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {selectedIds.map((id) => {
          const contact = contactMap.get(id);
          if (!contact) return null;
          return (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-primary-light)] px-2 py-1 text-xs font-semibold text-[var(--color-primary-dark)] dark:bg-white/10 dark:text-slate-100"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-[9px] font-black text-white">
                {personInitials(contact)}
              </span>
              <span className="max-w-44 truncate">{personName(contact)}</span>
              <button
                type="button"
                aria-label={`Remove ${personName(contact)} from ${label}`}
                onClick={() => onChange(selectedIds.filter((item) => item !== id))}
                className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          aria-label={`Search ${label} recipients`}
          placeholder={selectedIds.length ? "Add another" : `Search authorized ${label} recipients`}
          className="h-7 min-w-40 flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
        />
      </div>
      {focused && suggestions.length > 0 ? (
        <div
          role="listbox"
          aria-label={`${label} recipient suggestions`}
          className="absolute left-12 right-3 top-[calc(100%+4px)] z-20 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl"
        >
          {suggestions.map((contact) => (
            <button
              key={contact.id}
              type="button"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange([...selectedIds, contact.id]);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-light)] text-xs font-black text-[var(--color-primary-dark)]">
                {personInitials(contact)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--color-text-primary)]">
                  {personName(contact)}
                </span>
                <span className="block truncate text-xs text-[var(--color-text-muted)]">
                  {contact.email} · {contact.roles.join(", ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface MailComposeWindowProps {
  seed: ComposeSeed;
  contacts: MailContact[];
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (submission: ComposeSubmission) => void;
  onDiscard: (draftId?: string) => void;
}

export function MailComposeWindow({
  seed,
  contacts,
  pending,
  error,
  onClose,
  onSubmit,
  onDiscard,
}: MailComposeWindowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showCc, setShowCc] = useState(Boolean(seed.ccIds?.length));
  const [showBcc, setShowBcc] = useState(Boolean(seed.bccIds?.length));
  const [toIds, setToIds] = useState(seed.toIds || []);
  const [ccIds, setCcIds] = useState(seed.ccIds || []);
  const [bccIds, setBccIds] = useState(seed.bccIds || []);
  const [subject, setSubject] = useState(seed.subject || "");
  const [body, setBody] = useState(seed.body || "");
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState(
    seed.existingAttachments || [],
  );
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const dirty = Boolean(
    toIds.length ||
      ccIds.length ||
      bccIds.length ||
      subject.trim() ||
      body.trim() ||
      files.length ||
      existingAttachments.length !== (seed.existingAttachments?.length || 0),
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty || pending) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const requestClose = () => {
    if (
      !dirty ||
      pending ||
      window.confirm("Close this message? Unsaved changes will be lost.")
    ) {
      onClose();
    }
  };

  const unavailableFor = (field: "to" | "cc" | "bcc") =>
    new Set(
      [
        ...(field === "to" ? [] : toIds),
        ...(field === "cc" ? [] : ccIds),
        ...(field === "bcc" ? [] : bccIds),
      ],
    );

  const insertFormatting = (kind: "bold" | "italic" | "list") => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    const prefix = kind === "bold" ? "**" : kind === "italic" ? "*" : "- ";
    const suffix = kind === "list" ? "" : prefix;
    const replacement = `${prefix}${selected || (kind === "list" ? "List item" : "text")}${suffix}`;
    setBody(`${body.slice(0, start)}${replacement}${body.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    });
  };

  const submit = (action: "send" | "draft") => {
    onSubmit({
      action,
      draftId: seed.draftId,
      toIds,
      ccIds,
      bccIds,
      subject,
      body,
      files,
      keepAttachmentIds: existingAttachments.map((attachment) => attachment.id),
      sourceAttachmentIds: (seed.sourceAttachments || []).map(
        (attachment) => attachment.id,
      ),
    });
  };

  const handleShortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (toIds.length && subject.trim() && body.trim() && !pending) submit("send");
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mail-compose-title"
        className={`${
          expanded
            ? "h-[calc(100vh-1rem)] max-w-6xl sm:h-[calc(100vh-2rem)]"
            : "h-[min(760px,calc(100vh-1rem))] max-w-3xl sm:h-[min(720px,calc(100vh-3rem))]"
        } flex w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:rounded-2xl`}
      >
        <header className="flex h-14 shrink-0 items-center justify-between bg-[var(--color-primary)] px-4 text-white">
          <div>
            <h2 id="mail-compose-title" className="text-sm font-bold">
              {seed.draftId ? "Edit draft" : "New academic correspondence"}
            </h2>
            <p className="text-[11px] text-white/70">Internal Advisio mail</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Restore compose window" : "Expand compose window"}
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close compose window"
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p role="alert" className="m-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}
          <RecipientPicker
            label="To"
            contacts={contacts}
            selectedIds={toIds}
            unavailableIds={unavailableFor("to")}
            onChange={setToIds}
            required
          />
          {showCc ? (
            <RecipientPicker
              label="Cc"
              contacts={contacts}
              selectedIds={ccIds}
              unavailableIds={unavailableFor("cc")}
              onChange={setCcIds}
            />
          ) : null}
          {showBcc ? (
            <RecipientPicker
              label="Bcc"
              contacts={contacts}
              selectedIds={bccIds}
              unavailableIds={unavailableFor("bcc")}
              onChange={setBccIds}
            />
          ) : null}
          <div className="flex justify-end gap-3 border-b border-[var(--color-border)] px-4 py-1.5 text-xs font-bold text-[var(--color-primary)]">
            {!showCc ? <button type="button" onClick={() => setShowCc(true)}>Add Cc</button> : null}
            {!showBcc ? <button type="button" onClick={() => setShowBcc(true)}>Add Bcc</button> : null}
          </div>
          <label className="block border-b border-[var(--color-border)]">
            <span className="sr-only">Subject</span>
            <input
              value={subject}
              maxLength={255}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              className="h-12 w-full bg-transparent px-4 text-sm font-semibold text-[var(--color-text-primary)] outline-none placeholder:font-normal placeholder:text-[var(--color-text-muted)]"
            />
          </label>
          <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-3 py-2" aria-label="Message formatting">
            <button type="button" onClick={() => insertFormatting("bold")} aria-label="Bold" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--color-surface-muted)]"><Bold className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting("italic")} aria-label="Italic" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--color-surface-muted)]"><Italic className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting("list")} aria-label="Bulleted list" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--color-surface-muted)]"><List className="h-4 w-4" /></button>
            <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">Safe plain-text formatting</span>
          </div>
          <textarea
            ref={bodyRef}
            value={body}
            maxLength={50_000}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleShortcut}
            placeholder="Write your message"
            className="min-h-56 w-full resize-none bg-transparent p-4 text-sm leading-6 text-[var(--color-text-primary)] outline-none sm:min-h-72"
          />
          {existingAttachments.length || seed.sourceAttachments?.length || files.length ? (
            <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3">
              {existingAttachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold">
                  <Paperclip className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                  <button type="button" aria-label={`Remove ${attachment.fileName}`} onClick={() => setExistingAttachments((items) => items.filter((item) => item.id !== attachment.id))}><X className="h-4 w-4" /></button>
                </div>
              ))}
              {(seed.sourceAttachments || []).map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2 rounded-lg bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-dark)]">
                  <Paperclip className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">Forwarding {attachment.fileName}</span>
                </div>
              ))}
              {files.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold">
                  <Paperclip className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 sm:px-4">
          <button
            type="button"
            disabled={!toIds.length || !subject.trim() || !body.trim() || pending}
            onClick={() => submit("send")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-bold text-white hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />{pending ? "Working…" : "Send"}
          </button>
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => submit("draft")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-bold text-[var(--color-text-secondary)] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />Save draft
          </button>
          <label className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]" aria-label="Attach files">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))}
            />
          </label>
          <span className="hidden text-[11px] text-[var(--color-text-muted)] sm:inline">Ctrl+Enter to send · up to 5 files, 10 MB each</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(seed.draftId ? "Permanently discard this draft?" : "Discard this message?")) onDiscard(seed.draftId);
            }}
            aria-label="Discard message"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </footer>
      </section>
    </div>
  );
}
