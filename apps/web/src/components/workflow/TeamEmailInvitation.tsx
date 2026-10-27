import { useState } from "react";
import { apiClient } from "@/lib/api-client";

export function TeamEmailInvitation({
  teamId,
  kind,
}: {
  teamId: string;
  kind: "project" | "workspace";
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="rounded-xl border border-blue-100 bg-blue-50 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSending(true);
        setMessage("");
        try {
          const result = await apiClient.post<{ queued: number }>(
            kind === "project"
              ? `/api/research/${teamId}/team-invitations`
              : `/api/workspaces/${teamId}/invitations`,
            { email },
          );
          setMessage(
            result.queued
              ? "Invitation sent. The researcher can open it from Advisio notifications."
              : "This researcher has already been invited today.",
          );
          setEmail("");
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to send invitation.",
          );
        } finally {
          setSending(false);
        }
      }}
    >
      <h4 className="font-semibold text-slate-900">Invite a researcher</h4>
      <p className="mt-1 text-sm text-slate-600">
        Invite an approved researcher in your academic program using their
        registered email address.
      </p>
      <label className="mt-3 block text-sm font-semibold text-slate-700">
        Researcher email
        <input
          type="email"
          required
          maxLength={255}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-blue-200 bg-white px-3 py-2"
          placeholder="researcher@gmail.com"
        />
      </label>
      <button
        disabled={sending}
        className="mt-3 rounded-lg bg-[#173f63] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send invitation"}
      </button>
      {message && (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {message}
        </p>
      )}
    </form>
  );
}
