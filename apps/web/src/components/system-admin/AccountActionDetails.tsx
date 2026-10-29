import React from "react";

type Props = {
  type: "suspend" | "archive";
  working: boolean;
  suspensionReason: string;
  setSuspensionReason: (value: string) => void;
};

export function AccountActionDetails(props: Props) {
  const archive = props.type === "archive";
  return (
    <div className="mt-5 space-y-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        {archive
          ? "This moves the account to Archived users and immediately blocks sign-in and existing sessions. All records and files, including shared research work, remain intact. An administrator can restore access after identity verification."
          : "This immediately blocks sign-in and existing sessions. Research records remain intact. Restoring access requires identity verification and approval."}
      </p>
      <div>
        <label
          htmlFor="account-action-reason"
          className="mb-1 block text-sm font-bold"
        >
          {archive ? "Reason for archiving" : "Reason for suspension"}
        </label>
        <textarea
          id="account-action-reason"
          value={props.suspensionReason}
          onChange={(event) => props.setSuspensionReason(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={
            archive
              ? "Explain why this account is being archived (at least 10 characters)."
              : "Explain why this account is being suspended (at least 10 characters)."
          }
          disabled={props.working}
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] px-3 py-2 text-base"
        />
      </div>
    </div>
  );
}
