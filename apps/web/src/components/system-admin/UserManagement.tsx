import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";

type RoleName = "RESEARCHER" | "ADVISER" | "PANELIST" | "RESEARCH_COORDINATOR" | "RPO" | "REB" | "VPAA" | "SYSTEM_ADMIN";
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
  RESEARCH_COORDINATOR: "Professor / Coordinator",
  RPO: "Research Office Admin",
  REB: "Ethics Board",
  VPAA: "VPAA",
  SYSTEM_ADMIN: "System Admin",
};

const statusTone: Record<User["status"], string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  SUSPENDED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
};

type Dialog = { type: "approve" | "roles" | "delete"; user: User } | null;

export function UserManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const [verificationNote, setVerificationNote] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

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
    queryFn: () => apiClient.get<{ colleges: { id: string; code: string; name: string }[] }>("/api/colleges"),
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (usersQuery.data?.users || []).filter((user) => {
      const roleNames = user.roles.map((item) => item.role.name);
      const matchesSearch = !term || [user.universityId, user.email, user.firstName, user.middleName || "", user.lastName].join(" ").toLowerCase().includes(term);
      const matchesRole = roleFilter === "ALL" || roleNames.includes(roleFilter as RoleName);
      const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [usersQuery.data, search, roleFilter, statusFilter]);

  const openDialog = (type: NonNullable<Dialog>["type"], user: User) => {
    setDialog({ type, user });
    setSelectedRoles(user.roles.map((item) => item.role.name));
    setSelectedCollegeId(user.college?.id || "");
    setVerificationConfirmed(false);
    setVerificationNote("");
    setDeletePhrase("");
    setFeedback(null);
  };

  const closeDialog = () => {
    if (!working) setDialog(null);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["system-users"] });
  };

  const handleApprove = async () => {
    if (!dialog) return;
    setWorking(true);
    try {
      await apiClient.post(`/api/users/${dialog.user.id}/approve`, { verificationConfirmed, verificationNote });
      await refresh();
      setDialog(null);
      setFeedback({ tone: "success", message: `${dialog.user.universityId} was verified and approved.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof ApiError ? error.message : "Approval failed." });
    } finally {
      setWorking(false);
    }
  };

  const handleRoles = async () => {
    if (!dialog) return;
    setWorking(true);
    try {
      await apiClient.put(`/api/users/${dialog.user.id}/roles`, { roleNames: selectedRoles, collegeId: selectedCollegeId || null, verificationConfirmed, verificationNote });
      await refresh();
      setDialog(null);
      setFeedback({ tone: "success", message: `Verified roles were updated for ${dialog.user.universityId}.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof ApiError ? error.message : "Role update failed." });
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!dialog) return;
    setWorking(true);
    try {
      await apiClient.delete(`/api/users/${dialog.user.id}`, { body: JSON.stringify({ confirmation: deletePhrase }) });
      await refresh();
      setDialog(null);
      setFeedback({ tone: "success", message: `${dialog.user.universityId} was permanently deleted.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof ApiError ? error.message : "Deletion failed." });
    } finally {
      setWorking(false);
    }
  };

  const toggleRole = (role: RoleName) => {
    setSelectedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#101b2b] shadow-xs">
        <div className="border-b border-slate-100 dark:border-white/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">User Management</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Verify accounts, assign multiple institutional roles, suspend access, and manage every user category.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or ID" className="min-w-64 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-[#0B3A53]" />
              <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white px-3 py-2 text-xs">
                <option value="ALL">All categories</option>
                {rolesQuery.data?.roles.map((role) => <option key={role.id} value={role.name}>{roleLabels[role.name]}</option>)}
              </select>
              <select aria-label="Filter by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white px-3 py-2 text-xs">
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending verification</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {feedback && <div role="status" className={`m-5 rounded-xl border px-4 py-3 text-xs font-semibold ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300"}`}>{feedback.message}</div>}

        {usersQuery.isLoading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}</div>
        ) : usersQuery.isError ? (
          <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/40 p-5 text-center text-xs text-rose-700 dark:text-rose-300"><p>{usersQuery.error instanceof Error ? usersQuery.error.message : "Users could not be loaded."}</p><button onClick={() => void usersQuery.refetch()} className="mt-2 font-bold underline">Try again</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-400 font-black">
                <tr>{["ID", "User", "Category / Roles", "College / Program", "Status", "Last login", "Actions"].map((heading) => <th key={heading} className="px-5 py-3 font-extrabold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-[#0B3A53] dark:text-[#C9A227]">{user.universityId}</td>
                    <td className="px-5 py-4"><p className="font-extrabold text-slate-900 dark:text-white">{user.firstName} {user.middleName ? `${user.middleName} ` : ""}{user.lastName}</p><p className="mt-0.5 text-[11px] text-slate-400">{user.email}</p></td>
                    <td className="max-w-xs px-5 py-4"><div className="flex flex-wrap gap-1.5">{user.roles.map((item) => <span key={item.role.id} className="rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-[10px] font-extrabold">{roleLabels[item.role.name]}</span>)}</div></td>
                    <td className="px-5 py-4"><p className="font-bold text-slate-700 dark:text-slate-300">{user.college?.code || "—"}</p><p className="text-[10px] text-slate-400">{user.program?.code || "No program"}</p></td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${statusTone[user.status]}`}>{user.status}</span></td>
                    <td className="px-5 py-4 text-[11px] text-slate-500 dark:text-slate-400">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{user.status === "PENDING" && <button onClick={() => openDialog("approve", user)} className="rounded-lg bg-[#C9A227] px-3 py-1.5 font-extrabold text-[#0B3A53] hover:brightness-105">Verify & approve</button>}<button onClick={() => openDialog("roles", user)} className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">Manage roles</button><button onClick={() => openDialog("delete", user)} className="rounded-lg border border-rose-200 dark:border-rose-900/40 px-3 py-1.5 font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">No users match the selected filters.</div>}
          </div>
        )}
      </section>

      {dialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="user-dialog-title" className="text-base font-black text-slate-900 dark:text-white">{dialog.type === "approve" ? "Verify and approve account" : dialog.type === "roles" ? "Manage verified roles" : "Permanently delete user"}</h2><p className="mt-1 text-xs text-slate-400">{dialog.user.universityId} · {dialog.user.email}</p></div>
              <button onClick={closeDialog} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
            </div>

            {feedback?.tone === "error" && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">{feedback.message}</div>}

            {dialog.type === "roles" && <div className="mt-5 space-y-4"><div><label htmlFor="verified-college" className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">College / School assignment</label><select id="verified-college" value={selectedCollegeId} onChange={(event) => setSelectedCollegeId(event.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] px-3 py-2.5 text-xs text-slate-900 dark:text-white"><option value="">No college or school assigned</option>{collegesQuery.data?.colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select><p className="mt-1.5 text-[10px] text-slate-400">This is an organizational assignment, separate from access roles.</p></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{rolesQuery.data?.roles.map((role) => <label key={role.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 dark:border-white/10 p-3"><input type="checkbox" checked={selectedRoles.includes(role.name)} onChange={() => toggleRole(role.name)} className="mt-0.5 accent-[#C9A227]" /><span><strong className="block text-xs text-slate-900 dark:text-white">{roleLabels[role.name]}</strong><span className="text-[10px] text-slate-400">{role.description || role.name}</span></span></label>)}</div></div>}

            {(dialog.type === "approve" || dialog.type === "roles") && <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/30 p-4"><label className="flex items-start gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200"><input type="checkbox" checked={verificationConfirmed} onChange={(event) => setVerificationConfirmed(event.target.checked)} className="mt-0.5 accent-[#C9A227]" /><span>I verified this person’s identity and eligibility for the requested roles using institutional records.</span></label><div><label htmlFor="verification-note" className="mb-1 block text-[10px] font-bold text-slate-700 dark:text-slate-300">Verification note</label><textarea id="verification-note" value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} rows={3} placeholder="Describe the record or authority used for verification." className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] px-3 py-2 text-xs" /></div></div>}

            {dialog.type === "delete" && <div className="mt-5 space-y-4"><div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-300"><strong className="block">This permanently deletes the account.</strong><p className="mt-1">This cannot be undone. Accounts that own protected institutional records will be refused and should be suspended instead.</p></div><div><label htmlFor="delete-confirmation" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Type <code className="rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5">delete {dialog.user.universityId} sudo</code></label><input id="delete-confirmation" autoComplete="off" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} className="w-full rounded-xl border border-rose-300 dark:border-rose-800/40 bg-white dark:bg-[#101b2b] px-3 py-2.5 font-mono text-xs outline-none focus:ring-2 focus:ring-rose-100" /></div></div>}

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-white/5 pt-4"><button onClick={closeDialog} disabled={working} className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300">Cancel</button>{dialog.type === "approve" && <button onClick={() => void handleApprove()} disabled={working || !verificationConfirmed || verificationNote.trim().length < 10} className="rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-extrabold text-[#0B3A53] disabled:opacity-50 hover:brightness-105">Approve account</button>}{dialog.type === "roles" && <button onClick={() => void handleRoles()} disabled={working || selectedRoles.length === 0 || !verificationConfirmed || verificationNote.trim().length < 10} className="rounded-xl bg-[#0B3A53] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50 hover:bg-[#0E4968]">Save verified roles</button>}{dialog.type === "delete" && <button onClick={() => void handleDelete()} disabled={working || deletePhrase !== `delete ${dialog.user.universityId} sudo`} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50 hover:bg-rose-700">Permanently delete</button>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
