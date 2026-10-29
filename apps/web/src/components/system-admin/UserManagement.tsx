import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { AccountActionDetails } from "./AccountActionDetails";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Button } from "@/components/ui/Button";

type RoleName =
  | "RESEARCHER"
  | "ADVISER"
  | "PANELIST"
  | "RESEARCH_COORDINATOR"
  | "DEAN"
  | "SYSTEM_ADMIN";
type Role = { id: string; name: RoleName; description?: string | null };
type User = {
  id: string;
  universityId: string;
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | "INACTIVE";
  college?: { id: string; code: string; name: string } | null;
  program?: { code: string; name: string } | null;
  roles: { role: Role }[];
  createdAt: string;
  lastLoginAt?: string | null;
};

const roleLabels: Record<RoleName, string> = {
  RESEARCHER: "Researcher",
  ADVISER: "Adviser",
  PANELIST: "Panelist",
  RESEARCH_COORDINATOR: "Professor Coordinator",
  DEAN: "Dean",
  SYSTEM_ADMIN: "System Administration",
};

const isAssignableRole = (role: RoleName) => role !== "SYSTEM_ADMIN";

const statusTone: Record<User["status"], string> = {
  ACTIVE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  PENDING:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  SUSPENDED:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300",
  INACTIVE:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
};

type Dialog = {
  type: "approve" | "roles" | "college" | "suspend" | "archive";
  user: User;
} | null;

export function UserManagement({
  initialStatus = "ALL",
}: {
  initialStatus?: string;
}) {
  const queryClient = useQueryClient();
  const { user: signedInUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState(
    ["ACTIVE", "PENDING", "SUSPENDED", "INACTIVE"].includes(initialStatus)
      ? initialStatus
      : "ALL",
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const [verificationNote, setVerificationNote] = useState("");
  const [collegeReason, setCollegeReason] = useState("");
  const [suspensionReason, setSuspensionReason] = useState("");
  const [archivedView, setArchivedView] = useState(
    initialStatus === "INACTIVE",
  );
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["system-users"],
    queryFn: () => apiClient.get<{ users: User[] }>("/api/users"),
  });
  const rolesQuery = useQuery({
    queryKey: ["institutional-roles"],
    queryFn: () => apiClient.get<{ roles: Role[] }>("/api/users/meta/roles"),
  });
  const collegesQuery = useQuery({
    queryKey: ["institutional-units"],
    queryFn: () =>
      apiClient.get<{ colleges: { id: string; code: string; name: string }[] }>(
        "/api/colleges",
      ),
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (usersQuery.data?.users || []).filter((user) => {
      const roleNames = user.roles.map((item) => item.role.name);
      const matchesSearch =
        !term ||
        [
          user.universityId,
          user.email,
          user.firstName,
          user.middleName || "",
          user.lastName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesRole =
        roleFilter === "ALL" || roleNames.includes(roleFilter as RoleName);
      const matchesStatus =
        statusFilter === "ALL" || user.status === statusFilter;
      const matchesView = archivedView
        ? user.status === "INACTIVE"
        : user.status !== "INACTIVE";
      return (
        matchesView &&
        matchesSearch &&
        matchesRole &&
        (archivedView || matchesStatus)
      );
    });
  }, [usersQuery.data, search, roleFilter, statusFilter, archivedView]);

  const openDialog = (type: NonNullable<Dialog>["type"], user: User) => {
    setDialog({ type, user });
    setSelectedRoles(user.roles.map((item) => item.role.name));
    setSelectedCollegeId(user.college?.id || "");
    setVerificationConfirmed(false);
    setVerificationNote("");
    setCollegeReason("");
    setSuspensionReason("");
    setFeedback(null);
  };

  const closeDialog = () => {
    if (!working) setDialog(null);
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["system-users"] }),
      queryClient.invalidateQueries({ queryKey: ["system-admin-overview"] }),
    ]);
  };

  const handleApprove = async () => {
    if (!dialog) return;
    setWorking(true);
    try {
      await apiClient.post(`/api/users/${dialog.user.id}/approve`, {
        verificationConfirmed,
        verificationNote,
      });
      await refresh();
      setDialog(null);
      setFeedback({
        tone: "success",
        message: `${dialog.user.universityId} was verified and ${dialog.user.status === "INACTIVE" || dialog.user.status === "SUSPENDED" ? "restored" : "approved"}.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Approval failed.",
      });
    } finally {
      setWorking(false);
    }
  };

  const handleRoles = async () => {
    if (!dialog) return;
    setWorking(true);
    try {
      await apiClient.put(`/api/users/${dialog.user.id}/roles`, {
        roleNames: selectedRoles,
        verificationConfirmed,
        verificationNote,
      });
      await refresh();
      setDialog(null);
      setFeedback({
        tone: "success",
        message: `Verified roles were updated for ${dialog.user.universityId}.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof ApiError ? error.message : "Role update failed.",
      });
    } finally {
      setWorking(false);
    }
  };

  const handleCollege = async () => {
    if (!dialog) return;
    setWorking(true);
    try {
      await apiClient.patch(`/api/users/${dialog.user.id}/college`, {
        collegeId: selectedCollegeId || null,
        reason: collegeReason,
      });
      await refresh();
      setDialog(null);
      setFeedback({
        tone: "success",
        message: `College assignment was updated for ${dialog.user.universityId}.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "College assignment update failed.",
      });
    } finally {
      setWorking(false);
    }
  };

  const handleSuspend = async () => {
    if (!dialog || suspensionReason.trim().length < 10 || working) return;
    setWorking(true);
    setFeedback(null);
    try {
      await apiClient.patch(`/api/users/${dialog.user.id}/status`, {
        status: "SUSPENDED",
        verificationNote: suspensionReason.trim(),
      });
      await refresh();
      setDialog(null);
      setFeedback({
        tone: "success",
        message: `${dialog.user.universityId} was suspended. Sign-in and existing sessions are blocked.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof ApiError ? error.message : "Suspension failed.",
      });
    } finally {
      setWorking(false);
    }
  };

  const handleArchive = async () => {
    if (!dialog || suspensionReason.trim().length < 10 || working) return;
    setWorking(true);
    setFeedback(null);
    try {
      await apiClient.post(`/api/users/${dialog.user.id}/archive`, {
        reason: suspensionReason.trim(),
      });
      await refresh();
      setDialog(null);
      setFeedback({
        tone: "success",
        message: `${dialog.user.universityId} was archived. Access is blocked; all records and files are preserved. Find the account in Archived users.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof ApiError ? error.message : "Archiving failed.",
      });
    } finally {
      setWorking(false);
    }
  };

  const toggleRole = (role: RoleName) => {
    if (!isAssignableRole(role)) return;
    setSelectedRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#101b2b] shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                User Management
              </h2>
              <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                Verify accounts, assign multiple institutional roles, suspend
                access, and archive accounts while preserving their records and
                files.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                aria-label="Search users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, or ID"
                className="min-w-64 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2 text-base text-slate-900 dark:text-white outline-none focus:border-[#0B3A53]"
              />
              <select
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white px-3 py-2 text-base"
              >
                <option value="ALL">All categories</option>
                {rolesQuery.data?.roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {roleLabels[role.name]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by account status"
                disabled={archivedView}
                value={archivedView ? "INACTIVE" : statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white px-3 py-2 text-base"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending verification</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                {archivedView && <option value="INACTIVE">Archived</option>}
              </select>
            </div>
          </div>
        </div>

        <div
          className="flex gap-2 border-b border-slate-100 p-5 dark:border-white/5"
          role="group"
          aria-label="User account views"
        >
          <Button
            variant={archivedView ? "secondary" : "primary"}
            aria-pressed={!archivedView}
            onClick={() => {
              setArchivedView(false);
              if (statusFilter === "INACTIVE") setStatusFilter("ALL");
            }}
          >
            Current users
          </Button>
          <Button
            variant={archivedView ? "primary" : "secondary"}
            aria-pressed={archivedView}
            onClick={() => setArchivedView(true)}
          >
            Archived users
          </Button>
        </div>
        {archivedView && (
          <p className="px-5 pt-4 text-sm text-slate-500">
            Archived accounts cannot sign in. Their records and files are
            preserved. Verify identity before restoring access.
          </p>
        )}

        <ActionFeedback feedback={feedback} className="m-5" />

        {usersQuery.isLoading ? (
          <div className="p-5">
            <TableSkeleton rows={5} columns={7} />
          </div>
        ) : usersQuery.isError ? (
          <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/40 p-5 text-center text-xs text-rose-700 dark:text-rose-300">
            <p>
              {usersQuery.error instanceof Error
                ? usersQuery.error.message
                : "Users could not be loaded."}
            </p>
            <button
              onClick={() => void usersQuery.refetch()}
              className="mt-2 font-bold underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400 font-black">
                <tr>
                  {[
                    "ID",
                    "User",
                    "Category / Roles",
                    "College / Program",
                    "Status",
                    "Last login",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-5 py-3 font-extrabold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4 font-mono font-bold text-[#0B3A53] dark:text-[#C9A227]">
                      {user.universityId}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {user.firstName}{" "}
                        {user.middleName ? `${user.middleName} ` : ""}
                        {user.lastName}
                      </p>
                      <p className="mt-0.5 text-base text-slate-400">
                        {user.email}
                      </p>
                    </td>
                    <td className="max-w-xs px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((item) => (
                          <span
                            key={item.role.id}
                            className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-extrabold"
                          >
                            {roleLabels[item.role.name]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-700 dark:text-slate-300">
                        {user.college?.code || "—"}
                      </p>
                      <p className="text-base text-slate-400">
                        {user.program?.code || "No program"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${statusTone[user.status]}`}
                      >
                        {user.status === "INACTIVE" ? "ARCHIVED" : user.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.status !== "ACTIVE" && (
                          <button
                            onClick={() => openDialog("approve", user)}
                            className="rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-3 py-1.5 font-extrabold text-white transition"
                          >
                            {user.status === "SUSPENDED" ||
                            user.status === "INACTIVE"
                              ? "Verify & restore"
                              : "Verify & approve"}
                          </button>
                        )}
                        <button
                          onClick={() => openDialog("roles", user)}
                          className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          Manage roles
                        </button>
                        <button
                          onClick={() => openDialog("college", user)}
                          className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          Assign college
                        </button>
                        {user.status !== "SUSPENDED" &&
                          user.status !== "INACTIVE" && (
                            <button
                              onClick={() => openDialog("suspend", user)}
                              disabled={user.id === signedInUser?.id || working}
                              title={
                                user.id === signedInUser?.id
                                  ? "You cannot suspend your own account"
                                  : "Block sign-in while preserving records"
                              }
                              className="rounded-lg border border-amber-300 dark:border-amber-900/40 px-3 py-1.5 font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          )}
                        {user.status !== "INACTIVE" && (
                          <button
                            disabled={user.id === signedInUser?.id || working}
                            onClick={() => openDialog("archive", user)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 disabled:opacity-50"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                No users match the selected filters.
              </div>
            )}
          </div>
        )}
      </section>

      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-dialog-title"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="user-dialog-title"
                  className="text-lg font-black text-slate-900 dark:text-white"
                >
                  {dialog.type === "approve"
                    ? dialog.user.status === "INACTIVE" ||
                      dialog.user.status === "SUSPENDED"
                      ? "Verify and restore account"
                      : "Verify and approve account"
                    : dialog.type === "roles"
                      ? "Manage verified roles"
                      : dialog.type === "college"
                        ? "Assign college or school"
                        : dialog.type === "suspend"
                          ? "Suspend user account"
                          : "Archive user account"}
                </h2>
                <p className="mt-1 text-base text-slate-400">
                  {dialog.user.universityId} · {dialog.user.email}
                </p>
              </div>
              <button
                onClick={closeDialog}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {feedback?.tone === "error" && (
              <ActionFeedback feedback={feedback} className="mt-4" />
            )}

            {dialog.type === "roles" && (
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rolesQuery.data?.roles
                  .filter((role) => isAssignableRole(role.name))
                  .map((role) => (
                    <label
                      key={role.id}
                      className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 dark:border-white/10 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.name)}
                        onChange={() => toggleRole(role.name)}
                        className="mt-0.5 accent-[#C9A227]"
                      />
                      <span>
                        <strong className="block text-xs text-slate-900 dark:text-white">
                          {roleLabels[role.name]}
                        </strong>
                        <span className="text-xs text-slate-400">
                          {role.name === "DEAN"
                            ? "College research oversight and approvals"
                            : role.description || roleLabels[role.name]}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            )}

            {dialog.type === "college" && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                  College assignment controls which users, projects, and
                  defenses this account can access. Active cross-college
                  research assignments must be resolved before transfer.
                </div>
                <div>
                  <label
                    htmlFor="assigned-college"
                    className="mb-1.5 block text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    College / School assignment
                  </label>
                  <select
                    id="assigned-college"
                    value={selectedCollegeId}
                    onChange={(event) =>
                      setSelectedCollegeId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] px-3 py-2.5 text-base text-slate-900 dark:text-white"
                  >
                    <option value="">No college or school assigned</option>
                    {collegesQuery.data?.colleges.map((college) => (
                      <option key={college.id} value={college.id}>
                        {college.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="college-reason"
                    className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300"
                  >
                    Assignment or transfer reason
                  </label>
                  <textarea
                    id="college-reason"
                    value={collegeReason}
                    onChange={(event) => setCollegeReason(event.target.value)}
                    rows={3}
                    placeholder="Explain why this account belongs to the selected college or school."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] px-3 py-2 text-base"
                  />
                </div>
              </div>
            )}

            {(dialog.type === "approve" || dialog.type === "roles") && (
              <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/30 p-4">
                <label className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={verificationConfirmed}
                    onChange={(event) =>
                      setVerificationConfirmed(event.target.checked)
                    }
                    className="mt-0.5 accent-[#C9A227]"
                  />
                  <span>
                    I verified this person’s identity and eligibility for the
                    requested roles using institutional records.
                  </span>
                </label>
                <div>
                  <label
                    htmlFor="verification-note"
                    className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300"
                  >
                    Verification note
                  </label>
                  <textarea
                    id="verification-note"
                    value={verificationNote}
                    onChange={(event) =>
                      setVerificationNote(event.target.value)
                    }
                    rows={3}
                    placeholder="Describe the record or authority used for verification."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] px-3 py-2 text-base"
                  />
                </div>
              </div>
            )}

            {(dialog.type === "suspend" || dialog.type === "archive") && (
              <AccountActionDetails
                type={dialog.type}
                working={working}
                suspensionReason={suspensionReason}
                setSuspensionReason={setSuspensionReason}
              />
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5 pt-4">
              <Button
                onClick={closeDialog}
                disabled={working}
                variant="secondary"
              >
                Cancel
              </Button>
              {dialog.type === "approve" && (
                <Button
                  onClick={() => void handleApprove()}
                  disabled={
                    !verificationConfirmed ||
                    verificationNote.trim().length < 10
                  }
                  isLoading={working}
                  loadingText={
                    dialog.user.status === "INACTIVE" ||
                    dialog.user.status === "SUSPENDED"
                      ? "Restoring account..."
                      : "Approving account..."
                  }
                >
                  {dialog.user.status === "INACTIVE" ||
                  dialog.user.status === "SUSPENDED"
                    ? "Restore account"
                    : "Approve account"}
                </Button>
              )}
              {dialog.type === "roles" && (
                <Button
                  onClick={() => void handleRoles()}
                  disabled={
                    selectedRoles.length === 0 ||
                    !verificationConfirmed ||
                    verificationNote.trim().length < 10
                  }
                  isLoading={working}
                  loadingText="Saving roles..."
                >
                  Save verified roles
                </Button>
              )}
              {dialog.type === "college" && (
                <Button
                  onClick={() => void handleCollege()}
                  disabled={collegeReason.trim().length < 10}
                  isLoading={working}
                  loadingText="Saving assignment..."
                >
                  Save assignment
                </Button>
              )}
              {dialog.type === "suspend" && (
                <Button
                  onClick={() => void handleSuspend()}
                  disabled={suspensionReason.trim().length < 10}
                  isLoading={working}
                  loadingText="Suspending account..."
                  className="bg-amber-600 text-white border-amber-600 hover:bg-amber-700"
                >
                  Suspend account
                </Button>
              )}
              {dialog.type === "archive" && (
                <Button
                  onClick={() => void handleArchive()}
                  disabled={suspensionReason.trim().length < 10}
                  isLoading={working}
                  loadingText="Archiving account..."
                >
                  Archive account
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
