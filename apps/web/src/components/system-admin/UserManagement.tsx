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
  college?: { code: string; name: string } | null;
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
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  SUSPENDED: "border-rose-200 bg-rose-50 text-rose-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
};

type Dialog = { type: "approve" | "roles" | "delete"; user: User } | null;

export function UserManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>([]);
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
      await apiClient.put(`/api/users/${dialog.user.id}/roles`, { roleNames: selectedRoles, verificationConfirmed, verificationNote });
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
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#1b4264]">User Management</h2>
              <p className="mt-1 text-[12px] text-slate-500">Verify accounts, assign multiple institutional roles, suspend access, and manage every user category.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or ID" className="min-w-64 rounded-lg border border-slate-300 px-3 py-2 text-[12px] outline-none focus:border-[#1b4264]" />
              <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-[12px]">
                <option value="ALL">All categories</option>
                {rolesQuery.data?.roles.map((role) => <option key={role.id} value={role.name}>{roleLabels[role.name]}</option>)}
              </select>
              <select aria-label="Filter by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-[12px]">
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending verification</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {feedback && <div role="status" className={`m-5 rounded-lg border px-4 py-3 text-[12px] font-semibold ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{feedback.message}</div>}

        {usersQuery.isLoading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : usersQuery.isError ? (
          <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-5 text-center text-[12px] text-rose-700"><p>{usersQuery.error instanceof Error ? usersQuery.error.message : "Users could not be loaded."}</p><button onClick={() => void usersQuery.refetch()} className="mt-2 font-bold underline">Try again</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-[12px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>{["ID", "User", "Category / Roles", "College / Program", "Status", "Last login", "Actions"].map((heading) => <th key={heading} className="px-5 py-3 font-extrabold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-mono font-bold text-[#1b4264]">{user.universityId}</td>
                    <td className="px-5 py-4"><p className="font-extrabold text-slate-800">{user.firstName} {user.middleName ? `${user.middleName} ` : ""}{user.lastName}</p><p className="mt-0.5 text-[11px] text-slate-500">{user.email}</p></td>
                    <td className="max-w-xs px-5 py-4"><div className="flex flex-wrap gap-1.5">{user.roles.map((item) => <span key={item.role.id} className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-extrabold text-blue-700">{roleLabels[item.role.name]}</span>)}</div></td>
                    <td className="px-5 py-4"><p className="font-bold">{user.college?.code || "—"}</p><p className="text-[10px] text-slate-400">{user.program?.code || "No program"}</p></td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-[9px] font-extrabold ${statusTone[user.status]}`}>{user.status}</span></td>
                    <td className="px-5 py-4 text-[11px] text-slate-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{user.status === "PENDING" && <button onClick={() => openDialog("approve", user)} className="rounded-lg bg-[#ffa400] px-3 py-1.5 font-extrabold text-[#1b4264]">Verify & approve</button>}<button onClick={() => openDialog("roles", user)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50">Manage roles</button><button onClick={() => openDialog("delete", user)} className="rounded-lg border border-rose-200 px-3 py-1.5 font-bold text-rose-600 hover:bg-rose-50">Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && <div className="p-10 text-center text-[12px] text-slate-500">No users match the selected filters.</div>}
          </div>
        )}
      </section>

      {dialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="user-dialog-title" className="text-[16px] font-extrabold text-[#1b4264]">{dialog.type === "approve" ? "Verify and approve account" : dialog.type === "roles" ? "Manage verified roles" : "Permanently delete user"}</h2><p className="mt-1 text-[12px] text-slate-500">{dialog.user.universityId} · {dialog.user.email}</p></div>
              <button onClick={closeDialog} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕</button>
            </div>

            {feedback?.tone === "error" && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] font-semibold text-rose-700">{feedback.message}</div>}

            {dialog.type === "roles" && <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{rolesQuery.data?.roles.map((role) => <label key={role.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3"><input type="checkbox" checked={selectedRoles.includes(role.name)} onChange={() => toggleRole(role.name)} className="mt-0.5 accent-[#ffa400]" /><span><strong className="block text-[11px] text-slate-800">{roleLabels[role.name]}</strong><span className="text-[10px] text-slate-400">{role.description || role.name}</span></span></label>)}</div>}

            {(dialog.type === "approve" || dialog.type === "roles") && <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"><label className="flex items-start gap-2 text-[11px] font-semibold text-amber-900"><input type="checkbox" checked={verificationConfirmed} onChange={(event) => setVerificationConfirmed(event.target.checked)} className="mt-0.5 accent-[#ffa400]" /><span>I verified this person’s identity and eligibility for the requested roles using institutional records.</span></label><div><label htmlFor="verification-note" className="mb-1 block text-[10px] font-bold text-slate-700">Verification note</label><textarea id="verification-note" value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} rows={3} placeholder="Describe the record or authority used for verification." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px]" /></div></div>}

            {dialog.type === "delete" && <div className="mt-5 space-y-4"><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[12px] text-rose-800"><strong className="block">This permanently deletes the account.</strong><p className="mt-1">This cannot be undone. Accounts that own protected institutional records will be refused and should be suspended instead.</p></div><div><label htmlFor="delete-confirmation" className="mb-1.5 block text-[11px] font-bold text-slate-700">Type <code className="rounded bg-slate-100 px-1.5 py-0.5">delete {dialog.user.universityId} sudo</code></label><input id="delete-confirmation" autoComplete="off" value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} className="w-full rounded-lg border border-rose-300 px-3 py-2.5 font-mono text-[12px] outline-none focus:ring-2 focus:ring-rose-100" /></div></div>}

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4"><button onClick={closeDialog} disabled={working} className="rounded-lg border border-slate-300 px-4 py-2 text-[12px] font-bold text-slate-700">Cancel</button>{dialog.type === "approve" && <button onClick={() => void handleApprove()} disabled={working || !verificationConfirmed || verificationNote.trim().length < 10} className="rounded-lg bg-[#ffa400] px-4 py-2 text-[12px] font-extrabold text-[#1b4264] disabled:opacity-50">{working ? "Approving…" : "Approve account"}</button>}{dialog.type === "roles" && <button onClick={() => void handleRoles()} disabled={working || selectedRoles.length === 0 || !verificationConfirmed || verificationNote.trim().length < 10} className="rounded-lg bg-[#1b4264] px-4 py-2 text-[12px] font-extrabold text-white disabled:opacity-50">{working ? "Saving…" : "Save verified roles"}</button>}{dialog.type === "delete" && <button onClick={() => void handleDelete()} disabled={working || deletePhrase !== `delete ${dialog.user.universityId} sudo`} className="rounded-lg bg-rose-600 px-4 py-2 text-[12px] font-extrabold text-white disabled:opacity-50">{working ? "Deleting…" : "Permanently delete"}</button>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
