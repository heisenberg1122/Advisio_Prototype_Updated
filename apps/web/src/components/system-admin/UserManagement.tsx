import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { AccountActionDetails } from "./AccountActionDetails";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Button } from "@/components/ui/Button";
import { PhoneFilters } from "@/components/ui/PhoneFilters";
import { UserDetailsModal } from "./UserDetailsModal";
import { AccountInvitations, InviteAccountDialog } from "./AccountInvitations";
import { EmptyNote, SegmentedSwitch, StatusDot, type StatusTone } from "@/components/ui/advisio";
import { FilterChips, RoleBand, SearchField, initials } from "@/components/dashboards/RoleScreenParts";
import "./user-management.css";
import "./system-admin.css";

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
  collegeMemberships?: { collegeId: string; roleNames: RoleName[]; college: { id: string; name: string; code: string } }[];
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

const statusDotTone: Record<User["status"], StatusTone> = { ACTIVE: "done", PENDING: "waiting", SUSPENDED: "attention", INACTIVE: "neutral" };
const statusLabels: Record<User["status"], string> = { ACTIVE: "Active", PENDING: "Pending", SUSPENDED: "Suspended", INACTIVE: "Archived" };

function UserActionsMenu({
  name,
  canSuspend,
  canArchive,
  blocked,
  isSelf,
  onDetails,
  onRoles,
  onCollege,
  onSuspend,
  onArchive,
}: {
  name: string;
  canSuspend: boolean;
  canArchive: boolean;
  blocked: boolean;
  isSelf: boolean;
  onDetails: () => void;
  onRoles: () => void;
  onCollege: () => void;
  onSuspend: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<React.CSSProperties>({});
  const wrap = useRef<HTMLSpanElement>(null);
  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (open) return setOpen(false);
    // Fixed to the viewport so scrolling page areas cannot clip the menu.
    const box = event.currentTarget.getBoundingClientRect();
    const menuHeight = 216;
    const below = window.innerHeight - box.bottom > menuHeight + 12;
    setPlace({
      position: "fixed",
      right: Math.max(8, window.innerWidth - box.right),
      ...(below ? { top: box.bottom + 6 } : { bottom: window.innerHeight - box.top + 6 }),
      left: "auto",
    });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      wrap.current?.querySelector("button")?.focus();
    };
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <span className="sa-menu-wrap" ref={wrap}>
      <button type="button" className="rs-icon-btn" aria-label={`More actions for ${name}`} aria-expanded={open} onClick={toggle}>
        <i className="ti ti-dots" aria-hidden="true" />
      </button>
      <div className="sa-menu" hidden={!open} style={place}>
        <button type="button" onClick={choose(onDetails)}><i className="ti ti-id" aria-hidden="true" />View details</button>
        <button type="button" onClick={choose(onRoles)}><i className="ti ti-shield-check" aria-hidden="true" />Manage roles</button>
        <button type="button" onClick={choose(onCollege)}><i className="ti ti-building" aria-hidden="true" />Assign college</button>
        {canSuspend && (
          <button type="button" data-tone="danger" disabled={blocked} title={isSelf ? "You cannot suspend your own account" : "Block sign-in while preserving records"} onClick={choose(onSuspend)}><i className="ti ti-ban" aria-hidden="true" />Suspend</button>
        )}
        {canArchive && (
          <button type="button" data-tone="danger" disabled={blocked} onClick={choose(onArchive)}><i className="ti ti-archive" aria-hidden="true" />Archive</button>
        )}
      </div>
    </span>
  );
}

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
  const [invitationView, setInvitationView] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<User | undefined>(undefined);
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
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
      apiClient.get<{ colleges: { id: string; code: string; name: string; isActive?: boolean }[] }>(
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

  const currentUsers = (usersQuery.data?.users || []).filter((user) => user.status !== "INACTIVE");
  const countStatus = (status: User["status"]) => currentUsers.filter((user) => user.status === status).length;
  const pendingCount = countStatus("PENDING");
  const sortedUsers = [...filteredUsers].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));

  const openDialog = (type: NonNullable<Dialog>["type"], user: User) => {
    setDialog({ type, user });
    const collegeId = user.college?.id || user.collegeMemberships?.[0]?.collegeId || "";
    const collegeRoles = user.collegeMemberships?.find((membership) => membership.collegeId === collegeId)?.roleNames || [];
    setSelectedRoles([...collegeRoles, ...user.roles.map(({ role }) => role.name).filter((role) => ["RESEARCHER", "SYSTEM_ADMIN"].includes(role))]);
    setSelectedCollegeId(collegeId);
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
        collegeId: selectedCollegeId || null,
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
    <div className="admin-users rs">
      <RoleBand
        eyebrow="System administration"
        title="Users"
        titleId="sa-users-title"
        meta={`${pendingCount} ${pendingCount === 1 ? "account needs" : "accounts need"} verification · assign roles, colleges and access here`}
        phoneStatus={pendingCount ? `${pendingCount} ${pendingCount === 1 ? "account needs" : "accounts need"} verification` : undefined}
        counts={[
          { label: "Accounts", value: currentUsers.length },
          { label: "Active", value: countStatus("ACTIVE") },
          { label: "To approve", value: pendingCount, tone: pendingCount ? "waiting" : undefined },
          { label: "Suspended", value: countStatus("SUSPENDED") },
        ]}
        countsLabel="Account summary"
        primary={{ label: "Invite user", icon: "ti-user-plus", guide: "sa-invite-user", onClick: () => { setInviteTarget(undefined); setInviteOpen(true); } }}
      />
      <div className="rs-tools">
        <SegmentedSwitch
          label="User account views"
          value={invitationView ? "invites" : archivedView ? "archived" : "current"}
          onChange={(view) => {
            setInvitationView(view === "invites");
            setArchivedView(view === "archived");
            if (view !== "archived" && statusFilter === "INACTIVE") setStatusFilter("ALL");
          }}
          options={[
            { value: "current", label: "Current users" },
            { value: "archived", label: "Archived users" },
            { value: "invites", label: "Invitations" },
          ]}
        />
        {!invitationView && (
          <div className="rs-tools-end phone-filter-bar">
            <SearchField value={search} onChange={setSearch} placeholder="Search name, email, or ID" guide="sa-user-search" tour={false} />
            <PhoneFilters title="Filter accounts" activeCount={Number(roleFilter !== "ALL")} onClear={() => setRoleFilter("ALL")}>
              <select aria-label="Filter by role" className="rs-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="ALL">All categories</option>
                {rolesQuery.data?.roles.map((role) => (
                  <option key={role.id} value={role.name}>{roleLabels[role.name]}</option>
                ))}
              </select>
            </PhoneFilters>
          </div>
        )}
      </div>
      {!invitationView && !archivedView && (
        <FilterChips
          label="Filter by account status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "All", count: currentUsers.length },
            { value: "PENDING", label: "Pending verification", count: pendingCount },
            { value: "ACTIVE", label: "Active", count: countStatus("ACTIVE") },
            { value: "SUSPENDED", label: "Suspended", count: countStatus("SUSPENDED") },
          ]}
        />
      )}
      {archivedView && <p className="rs-note">Archived accounts cannot sign in. Their records and files are preserved. Verify identity before restoring access.</p>}
      <ActionFeedback feedback={feedback} />
      {invitationView ? (
        <div className="rs-table"><AccountInvitations /></div>
      ) : usersQuery.isLoading ? (
        <div className="rs-table" style={{ padding: 16 }}><TableSkeleton rows={5} columns={6} /></div>
      ) : usersQuery.isError ? (
        <div className="rs-empty-card" role="alert">
          <EmptyNote
            layout="row"
            tone="problem"
            icon="ti-alert-circle"
            title={usersQuery.error instanceof Error ? usersQuery.error.message : "Users could not be loaded."}
            action={<button type="button" className="au-link" onClick={() => void usersQuery.refetch()}>Try again</button>}
          />
        </div>
      ) : sortedUsers.length ? (
        <div className="rs-table sa-users-table" data-phone-rows="0" data-phone-summary="3" role="region" aria-label="User accounts" style={{ "--rs-cols": "minmax(0,1.6fr) minmax(0,1.1fr) 92px 100px 124px 176px" } as React.CSSProperties}>
          <div className="rs-row rs-row--head"><span>User</span><span>Roles</span><span>College</span><span>Status</span><span>Last login</span><span /></div>
          {sortedUsers.map((user) => {
            const name = `${user.firstName} ${user.middleName ? `${user.middleName} ` : ""}${user.lastName}`;
            const isSelf = user.id === signedInUser?.id;
            return (
              <div key={user.id} className={`rs-row rs-row--hover${user.status === "PENDING" ? " rs-row--tint" : ""}`}>
                <div className="rs-who">
                  <span className="rs-avatar" aria-hidden="true">{initials(`${user.firstName} ${user.lastName}`)}</span>
                  <span className="rs-text"><strong>{name}</strong><small>{user.universityId} · {user.email}</small></span>
                </div>
                <span className="sa-roles rs-wide">
                  {user.roles.map((item) => <span key={item.role.id} className="sa-role">{roleLabels[item.role.name]}</span>)}
                </span>
                <span className="rs-text rs-hide-small">
                  <strong data-weight="normal">{user.college?.code || "—"}</strong>
                  <small>{user.program?.code || "No program"}</small>
                </span>
                <StatusDot tone={statusDotTone[user.status]}>{statusLabels[user.status]}</StatusDot>
                <span className="rs-note rs-hide-small">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</span>
                <div className="rs-actions">
                  {user.status !== "ACTIVE" && (
                    <button type="button" className="rs-primary" onClick={() => openDialog("approve", user)}>
                      {user.status === "PENDING" ? "Verify & approve" : "Verify & restore"}
                    </button>
                  )}
                  <UserActionsMenu
                    name={name}
                    canSuspend={user.status !== "SUSPENDED" && user.status !== "INACTIVE"}
                    canArchive={user.status !== "INACTIVE"}
                    blocked={isSelf || working}
                    isSelf={isSelf}
                    onDetails={() => setDetailsUserId(user.id)}
                    onRoles={() => openDialog("roles", user)}
                    onCollege={() => openDialog("college", user)}
                    onSuspend={() => openDialog("suspend", user)}
                    onArchive={() => openDialog("archive", user)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rs-empty-card">
          <EmptyNote layout="row" icon="ti-search" title="No users match the selected filters" text="Try another filter or clear your search." />
        </div>
      )}

      {inviteOpen ? <InviteAccountDialog initialUser={inviteTarget} users={usersQuery.data?.users || []} colleges={collegesQuery.data?.colleges || []} onClose={() => setInviteOpen(false)} onSent={(message) => { setInviteOpen(false); setInvitationView(true); setArchivedView(false); setFeedback({ tone: "success", message }); }} onManageExisting={(id) => { const existing = usersQuery.data?.users.find((user) => user.id === id); if (existing) { setInviteOpen(false); openDialog("roles", existing); } }} /> : null}

      {detailsUserId && <UserDetailsModal userId={detailsUserId} onClose={() => setDetailsUserId(null)} />}
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
                <label className="text-sm font-semibold sm:col-span-2">College scope<select value={selectedCollegeId} onChange={(event) => { const collegeId = event.target.value; setSelectedCollegeId(collegeId); const faculty = dialog.user.collegeMemberships?.find((item) => item.collegeId === collegeId)?.roleNames || []; setSelectedRoles([...faculty, ...(collegeId === dialog.user.college?.id || !collegeId ? dialog.user.roles.map(({ role }) => role.name).filter((role) => ["RESEARCHER", "SYSTEM_ADMIN"].includes(role)) : [])]); }} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)]">{!dialog.user.college && <option value="">Global account roles</option>}{[...new Map([...(dialog.user.college ? [dialog.user.college] : []), ...(dialog.user.collegeMemberships || []).map((item) => item.college)].map((college) => [college.id, college])).values()].map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select></label>
                <p className="text-sm text-[var(--color-text-secondary)] sm:col-span-2">Remove approved faculty roles here. New faculty roles and additional colleges require an invitation accepted by the account owner.</p>
                <Button className="sm:col-span-2" variant="secondary" onClick={() => { setInviteTarget(dialog.user); setDialog(null); setInviteOpen(true); }}>Invite additional college access</Button>
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
                        disabled={role.name === "RESEARCHER" ? selectedCollegeId !== (dialog.user.college?.id || "") : !dialog.user.collegeMemberships?.find((membership) => membership.collegeId === selectedCollegeId)?.roleNames.includes(role.name)}
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
