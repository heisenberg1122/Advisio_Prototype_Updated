import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
const button =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-bold text-[var(--color-text-primary)] disabled:opacity-50";
export function WorkflowAccessManager({
  workflowId,
  workflowName,
  children,
}: {
  workflowId?: string;
  workflowName?: string;
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [tab, setTab] = useState("Members");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTab("Members");
    setSelected({});
    setResults([]);
    setError("");
    setNotice("");
    setSearch("");
  }, [workflowId]);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const access = useQuery({
    queryKey: ["workflow-access", workflowId],
    queryFn: () =>
      apiClient.get<{ entries: any[] }>(`/api/workflows/${workflowId}/access`),
    enabled: Boolean(workflowId),
    refetchInterval: 15000,
    retry: false,
  });
  const contacts = useQuery({
    queryKey: ["workflow-access-contacts", workflowId, query],
    queryFn: () =>
      apiClient.get<{ contacts: any[] }>(
        `/api/workflows/${workflowId}/access/contacts`,
        { params: { q: query } },
      ),
    enabled: Boolean(workflowId && tab === "Invitations" && !access.isError),
  });
  const refresh = async () => {
    await client.invalidateQueries({
      predicate: (q) =>
        /workflow|enrollment|mail/.test(JSON.stringify(q.queryKey)),
    });
    window.dispatchEvent(new Event("notifications-updated"));
  };
  async function action(entry: any, value: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiClient.post(
        `/api/workflows/access/${entry.id}/${value === "resend" ? "resend" : "decision"}`,
        { action: value },
      );
      setNotice(
        value === "resend"
          ? "Invitation reminder sent."
          : "Process access updated.",
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function send(ids: string[]) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const names = {
        ...selected,
        ...Object.fromEntries(
          (contacts.data?.contacts || []).map((c) => [c.id, c]),
        ),
        ...Object.fromEntries(
          (access.data?.entries || []).map((e) => [e.userId, e.user]),
        ),
      };
      const response = await apiClient.post<{ results: any[] }>(
        `/api/workflows/${workflowId}/access/invitations`,
        { userIds: ids },
      );
      setResults(
        response.results.map((r) => ({
          ...r,
          email: names[r.userId]?.email || r.userId,
        })),
      );
      setSelected((v) =>
        Object.fromEntries(
          Object.entries(v).filter(([id]) =>
            response.results.some(
              (r) => r.userId === id && r.status === "Failed",
            ),
          ),
        ),
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    if (
      !window.confirm(
        "Disable this workflow's code and shared link? Existing requests remain reviewable.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiClient.delete(`/api/workflows/${workflowId}/invitation`);
      setNotice("Code and shared link disabled.");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!workflowId) return <>{children}</>;
  const entries = access.data?.entries || [];
  const pending = entries.filter(
    (e) => e.kind === "REQUEST" && e.status === "PENDING",
  );
  const shown =
    tab === "Join requests"
      ? pending
      : entries.filter((e) => e.kind === "INVITATION");
  return (
    <div className="space-y-4"><p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-secondary)]">Process Access manages permissions for this template. It does not add researchers to an academic cohort. Use Research Cohorts for cohort membership. Revoking process access preserves historical records.</p>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Process access"
      >
        {["Members", "Join requests", "Invitations"].map((t) => (
          <button
            type="button"
            key={t}
            role="tab"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
            className={`${button} ${t === tab ? "!bg-[#173f63] !text-white" : ""}`}
          >
            {t}
            {t === "Join requests" && pending.length
              ? ` (${pending.length})`
              : ""}
          </button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {access.isError && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          {(access.error as Error).message}
        </p>
      )}
      {tab === "Members" ? (
        <>
          {children}
          {!access.isError && (
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={() => void disable()}
            >
              Disable code and shared link
            </button>
          )}
        </>
      ) : (
        <section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="font-bold">
            {tab} for {workflowName}
          </h3>
          {tab === "Invitations" && !access.isError && (
            <div className="space-y-3 rounded-xl bg-[var(--color-surface-muted)] p-4">
              <p className="text-sm">
                Select up to 50 registered researchers. Invitations arrive in
                their Advisio inbox. Inviting a removed researcher explicitly
                authorizes restoring their access when they accept.
              </p>
              <input
                aria-label="Search researchers by name or email"
                placeholder="Search name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {Object.values(selected).map((c: any) => (
                  <button
                    type="button"
                    key={c.id}
                    className={button}
                    onClick={() =>
                      setSelected((v) => {
                        const next = { ...v };
                        delete next[c.id];
                        return next;
                      })
                    }
                  >
                    {c.firstName} {c.lastName} ×
                  </button>
                ))}
              </div>
              <div className="max-h-52 space-y-1 overflow-auto">
                {contacts.isPending ? (
                  <p>Loading researchers...</p>
                ) : contacts.isError ? (
                  <p role="alert">Researchers could not be loaded.</p>
                ) : !contacts.data?.contacts.length ? (
                  <p>No eligible researchers found.</p>
                ) : (
                  contacts.data.contacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg bg-[var(--color-surface)] p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(selected[c.id])}
                        disabled={
                          busy ||
                          (!selected[c.id] &&
                            Object.keys(selected).length >= 50)
                        }
                        onChange={(e) =>
                          setSelected((v) => {
                            const next = { ...v };
                            if (e.target.checked) next[c.id] = c;
                            else delete next[c.id];
                            return next;
                          })
                        }
                      />
                      <span>
                        {c.firstName} {c.lastName}
                        <span className="block text-xs text-[var(--color-text-secondary)]">
                          {c.email}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              <button
                type="button"
                className={button}
                disabled={busy || !Object.keys(selected).length}
                onClick={() => void send(Object.keys(selected))}
              >
                {busy
                  ? "Sending..."
                  : `Send invitations (${Object.keys(selected).length})`}
              </button>
              {results.map((r) => (
                <p role="status" key={r.userId} className="text-xs">
                  {r.email}: {r.status}
                  {r.error ? ` - ${r.error}` : ""}
                </p>
              ))}
            </div>
          )}
          {access.isPending ? (
            <p>Loading...</p>
          ) : !shown.length ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {tab === "Join requests"
                ? "No pending join requests."
                : "No invitations sent yet."}
            </p>
          ) : (
            shown.map((e) => (
              <article
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
              >
                <div>
                  <strong className="text-sm">
                    {e.user.firstName} {e.user.lastName}
                  </strong>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {e.user.email} · {e.user.universityId} ·{" "}
                    {e.user.program?.name}
                  </p>
                  <p className="text-xs">
                    {new Date(e.createdAt).toLocaleString()} ·{" "}
                    {e.status.toLowerCase()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {e.kind === "REQUEST" ? (
                    <>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void action(e, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void action(e, "decline")}
                      >
                        Decline
                      </button>
                    </>
                  ) : e.status === "PENDING" ? (
                    <>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void action(e, "resend")}
                      >
                        Resend
                      </button>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void action(e, "revoke")}
                      >
                        Revoke
                      </button>
                    </>
                  ) : (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => void send([e.userId])}
                    >
                      Send new invitation
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
