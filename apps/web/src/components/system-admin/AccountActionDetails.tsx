import React from "react";

export type DeletionPreview = {
  token: string;
  totalRecords: number;
  files: number;
  affectedOtherUsers: number;
  records: { type: string; count: number }[];
};

type Props = {
  type: "suspend" | "delete";
  universityId: string;
  working: boolean;
  suspensionReason: string;
  setSuspensionReason: (value: string) => void;
  preview?: DeletionPreview;
  loading: boolean;
  error: string | null;
  retry: () => void;
  acknowledged: boolean;
  setAcknowledged: (value: boolean) => void;
  deletePhrase: string;
  setDeletePhrase: (value: string) => void;
};

export function AccountActionDetails(props: Props) {
  if (props.type === "suspend")
    return (
      <div className="mt-5 space-y-4">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          This immediately blocks sign-in and existing sessions. Research
          records remain intact. Restoring access requires identity verification
          and approval.
        </p>
        <div>
          <label
            htmlFor="suspension-reason"
            className="mb-1 block text-sm font-bold"
          >
            Reason for suspension
          </label>
          <textarea
            id="suspension-reason"
            value={props.suspensionReason}
            onChange={(event) => props.setSuspensionReason(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Explain why this account is being suspended (at least 10 characters)."
            disabled={props.working}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] px-3 py-2 text-base"
          />
        </div>
      </div>
    );

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-300">
        <strong className="block">
          This permanently deletes the account and its associated data.
        </strong>
        <p className="mt-1">
          Created projects, workspaces, submissions, reviews, messages, files,
          and their dependent records will be deleted. Shared projects created
          by this user may include other members’ work. Other user accounts are
          kept. This cannot be undone. Suspend instead to preserve the records.
        </p>
        <p className="mt-2">
          Stored files are also removed, unless still used by surviving records.
          One administrator deletion audit entry is retained.
        </p>
      </div>
      {props.loading && (
        <p role="status" className="text-sm text-slate-500">
          Checking linked records…
        </p>
      )}
      {props.error && (
        <div role="alert" className="text-sm text-rose-600">
          <p>{props.error}</p>
          <button
            disabled={props.working || props.loading}
            onClick={props.retry}
            className="mt-2 font-bold underline"
          >
            Retry preview
          </button>
        </div>
      )}
      {props.preview && !props.error && (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 text-sm">
          <p className="font-bold">
            Deletion impact: {props.preview.totalRecords} records and{" "}
            {props.preview.files} stored files
          </p>
          {props.preview.affectedOtherUsers > 0 && (
            <p className="mt-2 font-bold text-rose-600 dark:text-rose-300">
              Shared records involving {props.preview.affectedOtherUsers} other
              users will be affected.
            </p>
          )}
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {props.preview.records.map((record) => (
              <li key={record.type} className="flex justify-between gap-3">
                <span>{record.type.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
                <span className="font-mono">{record.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={props.acknowledged}
          onChange={(event) => props.setAcknowledged(event.target.checked)}
          disabled={
            props.working ||
            !props.preview ||
            props.loading ||
            Boolean(props.error)
          }
          className="mt-1 accent-rose-600"
        />
        <span>
          I reviewed the deletion impact and understand that the listed records,
          including affected shared work, will be permanently deleted.
        </span>
      </label>
      <div>
        <label
          htmlFor="delete-confirmation"
          className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300"
        >
          Type{" "}
          <code className="rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5">
            delete {props.universityId} sudo
          </code>
        </label>
        <input
          id="delete-confirmation"
          autoComplete="off"
          value={props.deletePhrase}
          onChange={(event) => props.setDeletePhrase(event.target.value)}
          disabled={props.working || props.loading}
          className="w-full rounded-xl border border-rose-300 dark:border-rose-800/40 bg-white dark:bg-[#101b2b] px-3 py-2.5 font-mono text-base outline-none focus:ring-2 focus:ring-rose-100"
        />
      </div>
    </div>
  );
}
