import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";
import { resolvePostLoginAction } from "@/lib/post-login-navigation";

export function CollegeSwitcher() {
  const { user, switchCollege, isSwitchingCollege } = useAuth();
  const { hasDirtyForms } = useDashboardWorkspace();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const memberships = user?.collegeMemberships || [];
  if (memberships.length < 2) return null;
  async function change(collegeId: string) {
    if (collegeId === user?.college?.id || isSwitchingCollege) return;
    if (
      hasDirtyForms() &&
      !window.confirm("Switch colleges and leave your unsaved changes?")
    )
      return;
    setError("");
    try {
      const updated = await switchCollege(collegeId);
      navigate(resolvePostLoginAction({ roles: updated.roles }).url, {
        replace: true,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to switch colleges.",
      );
    }
  }
  return (
    <div className="min-w-0 space-y-1">
      <label className="block text-xs font-semibold text-[var(--color-text-muted)]">
        Active college
        <select
          aria-label="Active college"
          value={user?.college?.id || ""}
          disabled={isSwitchingCollege}
          onChange={(event) => void change(event.target.value)}
          className="mt-1 min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)]"
        >
          {memberships.map(({ college }) => (
            <option key={college.id} value={college.id}>
              {college.name} ({college.code})
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
