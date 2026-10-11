"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Building2,
  CheckCircle2,
  GraduationCap,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/Skeleton";

type Major = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
};

type Program = {
  id: string;
  collegeId: string;
  code: string;
  name: string;
  description: string | null;
  hasMajors: boolean;
  isActive: boolean;
  majors: Major[];
  _count: {
    users: number;
    researchProjects: number;
    researchTypes: number;
    calendarEvents: number;
  };
};

type College = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programs: Program[];
  _count: { users: number; researchProjects: number; programs: number };
};

type DraftMajor = { name: string; code: string };
type Editor =
  | {
      kind: "college";
      id?: string;
      name: string;
      code: string;
      description: string;
      password: string;
    }
  | {
      kind: "program";
      id?: string;
      collegeId: string;
      name: string;
      code: string;
      description: string;
      hasMajors: boolean;
      majors: DraftMajor[];
      password: string;
    }
  | {
      kind: "major";
      id?: string;
      programId: string;
      name: string;
      code: string;
      description: string;
      password: string;
    };

type StatusChange = {
  kind: "college" | "program" | "major";
  id: string;
  label: string;
  isActive: boolean;
  password: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-[#0B3A53] dark:border-white/10 dark:bg-white/5 dark:text-white";

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#101b2b]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
      Confirm with your password
      <div className="relative mt-1.5">
        <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-[#C9A227]" />
        <input
          required
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pl-9`}
          placeholder="Enter your current password"
        />
      </div>
      <span className="mt-1 block font-medium text-slate-400">
        Required for every academic-structure change.
      </span>
    </label>
  );
}

export function AcademicStructureManagement() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["system-admin-academic-structure"],
    queryFn: () =>
      apiClient.get<{ colleges: College[] }>("/api/academic-structure"),
    staleTime: 30_000,
  });

  const colleges = data?.colleges || [];
  const visibleColleges = colleges.filter(
    (college) => showArchived || college.isActive,
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["system-admin-academic-structure"],
      }),
      queryClient.invalidateQueries({ queryKey: ["admin-colleges"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-programs"] }),
    ]);
  };

  const finish = async (message: string) => {
    await refresh();
    setEditor(null);
    setStatusChange(null);
    setError(null);
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 3500);
  };

  const submitEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editor.kind === "college") {
        const body = {
          name: editor.name,
          code: editor.code,
          description: editor.description,
          password: editor.password,
          ...(!editor.id && { isActive: true }),
        };
        if (editor.id)
          await apiClient.patch(`/api/colleges/${editor.id}`, body);
        else await apiClient.post("/api/colleges", body);
        await finish(editor.id ? "College updated." : "College created.");
      } else if (editor.kind === "program") {
        const body = {
          collegeId: editor.collegeId,
          name: editor.name,
          code: editor.code,
          description: editor.description,
          hasMajors: editor.hasMajors,
          password: editor.password,
          ...(!editor.id && { isActive: true }),
          ...(!editor.id && {
            majors: editor.hasMajors
              ? editor.majors
                  .filter((major) => major.name.trim())
                  .map((major) => ({ name: major.name, code: major.code }))
              : [],
          }),
        };
        if (editor.id)
          await apiClient.patch(`/api/programs/${editor.id}`, body);
        else await apiClient.post("/api/programs", body);
        await finish(editor.id ? "Program updated." : "Program created.");
      } else {
        const body = {
          name: editor.name,
          code: editor.code,
          description: editor.description,
          password: editor.password,
        };
        if (editor.id)
          await apiClient.patch(`/api/program-majors/${editor.id}`, body);
        else
          await apiClient.post(
            `/api/programs/${editor.programId}/majors`,
            body,
          );
        await finish(editor.id ? "Major updated." : "Major added.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The change could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitStatusChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusChange) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        password: statusChange.password,
        isActive: !statusChange.isActive,
      };
      const path =
        statusChange.kind === "college"
          ? `/api/colleges/${statusChange.id}`
          : statusChange.kind === "program"
            ? `/api/programs/${statusChange.id}`
            : `/api/program-majors/${statusChange.id}`;
      await apiClient.patch(path, body);
      await finish(
        `${statusChange.label} ${statusChange.isActive ? "archived" : "restored"}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The status could not be changed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {success && (
        <div className="fixed right-5 top-5 z-[60] flex items-center gap-2 rounded-xl bg-[#0B3A53] px-4 py-3 text-xs font-bold text-white shadow-xl">
          <CheckCircle2 className="h-4 w-4 text-[#C9A227]" /> {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#101b2b]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A227]">
              Academic registry
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
              Colleges, programs & majors
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Manage the institution hierarchy without removing historical
              records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowArchived((value) => !value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </button>
            <button
              type="button"
              onClick={() =>
                setEditor({
                  kind: "college",
                  name: "",
                  code: "",
                  description: "",
                  password: "",
                })
              }
              className="inline-flex items-center gap-2 rounded-xl border border-[#0B3A53] px-4 py-2 text-xs font-black text-[#0B3A53] dark:border-[#C9A227] dark:text-[#C9A227]"
            >
              <Plus className="h-4 w-4" /> College
            </button>
            <button
              type="button"
              disabled={!colleges.some((college) => college.isActive)}
              onClick={() =>
                setEditor({
                  kind: "program",
                  collegeId:
                    colleges.find((college) => college.isActive)?.id || "",
                  name: "",
                  code: "",
                  description: "",
                  hasMajors: false,
                  majors: [],
                  password: "",
                })
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-black text-[#0B3A53] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Program
            </button>
          </div>
        </div>
      </section>

      {isError && (
        <button
          type="button"
          onClick={() => void refetch()}
          className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-5 text-left text-xs font-bold text-rose-700"
        >
          The academic structure could not be loaded. Click to retry.
        </button>
      )}

      {!isError && visibleColleges.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-[#101b2b]">
          No {showArchived ? "colleges" : "active colleges"} found.
        </div>
      )}

      {visibleColleges.map((college) => (
        <section
          key={college.id}
          className={`rounded-2xl border bg-white p-5 shadow-xs dark:bg-[#101b2b] ${college.isActive ? "border-slate-200/80 dark:border-white/10" : "border-amber-200 opacity-75 dark:border-amber-500/30"}`}
        >
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5 sm:flex-row sm:items-start">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0B3A53]/10 text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {college.name}
                  </h3>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {college.code}
                  </span>
                  {!college.isActive && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">
                      Archived
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {college._count.programs} programs · {college._count.users}{" "}
                  users · {college._count.researchProjects} projects
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setEditor({
                    kind: "college",
                    id: college.id,
                    name: college.name,
                    code: college.code,
                    description: college.description || "",
                    password: "",
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() =>
                  setStatusChange({
                    kind: "college",
                    id: college.id,
                    label: college.name,
                    isActive: college.isActive,
                    password: "",
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                {college.isActive ? (
                  <Archive className="h-3.5 w-3.5" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}{" "}
                {college.isActive ? "Archive" : "Restore"}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {college.programs
              .filter((program) => showArchived || program.isActive)
              .map((program) => (
                <div
                  key={program.id}
                  className={`rounded-xl border p-4 ${program.isActive ? "border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-white/[0.02]" : "border-amber-100 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-500/5"}`}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {program.name}
                        </span>
                        <span className="font-mono text-[10px] font-black text-[#8A6A0B] dark:text-[#C9A227]">
                          {program.code}
                        </span>
                        {program.hasMajors && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700">
                            Offers majors
                          </span>
                        )}
                        {!program.isActive && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {program._count.users} users ·{" "}
                        {program._count.researchProjects} projects ·{" "}
                        {program._count.researchTypes} research types
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {program.hasMajors && program.isActive && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditor({
                              kind: "major",
                              programId: program.id,
                              name: "",
                              code: "",
                              description: "",
                              password: "",
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
                        >
                          <Plus className="h-3 w-3" /> Major
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEditor({
                            kind: "program",
                            id: program.id,
                            collegeId: program.collegeId,
                            name: program.name,
                            code: program.code,
                            description: program.description || "",
                            hasMajors: program.hasMajors,
                            majors: [],
                            password: "",
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setStatusChange({
                            kind: "program",
                            id: program.id,
                            label: program.name,
                            isActive: program.isActive,
                            password: "",
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
                      >
                        {program.isActive ? (
                          <Archive className="h-3 w-3" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}{" "}
                        {program.isActive ? "Archive" : "Restore"}
                      </button>
                    </div>
                  </div>

                  {program.hasMajors &&
                    program.majors.filter(
                      (major) => showArchived || major.isActive,
                    ).length > 0 && (
                      <div className="mt-3 grid gap-2 border-t border-slate-200/70 pt-3 dark:border-white/5 sm:grid-cols-2">
                        {program.majors
                          .filter((major) => showArchived || major.isActive)
                          .map((major) => (
                            <div
                              key={major.id}
                              className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-white/5"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" />
                                <span className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                  {major.name}
                                </span>
                                {major.code && (
                                  <span className="text-[9px] text-slate-400">
                                    {major.code}
                                  </span>
                                )}
                                {!major.isActive && (
                                  <span className="text-[9px] font-bold text-amber-600">
                                    Archived
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditor({
                                      kind: "major",
                                      id: major.id,
                                      programId: program.id,
                                      name: major.name,
                                      code: major.code || "",
                                      description: major.description || "",
                                      password: "",
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-[#0B3A53]"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusChange({
                                      kind: "major",
                                      id: major.id,
                                      label: major.name,
                                      isActive: major.isActive,
                                      password: "",
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-[#0B3A53]"
                                >
                                  {major.isActive ? (
                                    <Archive className="h-3 w-3" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              ))}
            {college.programs.filter(
              (program) => showArchived || program.isActive,
            ).length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400 dark:border-white/10">
                No {showArchived ? "programs" : "active programs"} in this
                college.
              </p>
            )}
          </div>
        </section>
      ))}

      {editor && (
        <Dialog
          title={`${editor.id ? "Edit" : "Add"} ${editor.kind === "college" ? "college" : editor.kind === "program" ? "program" : "major / specialization"}`}
          onClose={() => {
            setEditor(null);
            setError(null);
          }}
        >
          <form onSubmit={submitEditor} className="space-y-4">
            {editor.kind === "program" && (
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                College
                <select
                  required
                  value={editor.collegeId}
                  onChange={(event) =>
                    setEditor({ ...editor, collegeId: event.target.value })
                  }
                  className={`${inputClass} mt-1.5`}
                >
                  <option value="">Select a college</option>
                  {colleges
                    .filter((college) => college.isActive)
                    .map((college) => (
                      <option key={college.id} value={college.id}>
                        {college.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Name
              <input
                required
                value={editor.name}
                onChange={(event) =>
                  setEditor({ ...editor, name: event.target.value })
                }
                className={`${inputClass} mt-1.5`}
                placeholder={
                  editor.kind === "college"
                    ? "College of Science"
                    : editor.kind === "program"
                      ? "BS Information Technology"
                      : "Web and Mobile Development"
                }
              />
            </label>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Code{" "}
              {editor.kind === "major" && (
                <span className="font-medium text-slate-400">(optional)</span>
              )}
              <input
                required={editor.kind !== "major"}
                value={editor.code}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    code: event.target.value.toUpperCase(),
                  })
                }
                className={`${inputClass} mt-1.5`}
                placeholder={
                  editor.kind === "college"
                    ? "CIT"
                    : editor.kind === "program"
                      ? "BSIT"
                      : "WMA"
                }
              />
            </label>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Description{" "}
              <span className="font-medium text-slate-400">(optional)</span>
              <textarea
                value={editor.description}
                onChange={(event) =>
                  setEditor({ ...editor, description: event.target.value })
                }
                className={`${inputClass} mt-1.5 min-h-20 resize-y`}
              />
            </label>

            {editor.kind === "program" && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span>
                    <span className="block">
                      Offers majors or specializations
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                      Turn this on only when the program has formal tracks.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={editor.hasMajors}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        hasMajors: event.target.checked,
                        majors: event.target.checked ? editor.majors : [],
                      })
                    }
                    className="h-4 w-4 accent-[#C9A227]"
                  />
                </label>
                {editor.id && !editor.hasMajors && (
                  <p className="mt-2 text-[10px] font-semibold text-amber-600">
                    Saving this setting will archive all active majors under the
                    program.
                  </p>
                )}
                {!editor.id && editor.hasMajors && (
                  <div className="mt-3 space-y-2">
                    {editor.majors.map((major, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[1fr_7rem_auto] gap-2"
                      >
                        <input
                          value={major.name}
                          onChange={(event) =>
                            setEditor({
                              ...editor,
                              majors: editor.majors.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            })
                          }
                          className={inputClass}
                          placeholder="Major name"
                        />
                        <input
                          value={major.code}
                          onChange={(event) =>
                            setEditor({
                              ...editor,
                              majors: editor.majors.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      code: event.target.value.toUpperCase(),
                                    }
                                  : item,
                              ),
                            })
                          }
                          className={inputClass}
                          placeholder="Code"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditor({
                              ...editor,
                              majors: editor.majors.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            })
                          }
                          className="p-2 text-rose-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          ...editor,
                          majors: [...editor.majors, { name: "", code: "" }],
                        })
                      }
                      className="text-[10px] font-black text-[#0B3A53] dark:text-[#C9A227]"
                    >
                      + Add initial major
                    </button>
                  </div>
                )}
              </div>
            )}

            <PasswordField
              value={editor.password}
              onChange={(password) => setEditor({ ...editor, password })}
            />
            {error && (
              <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/5">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                type="submit"
                className="rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-black text-[#0B3A53] disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Confirm & save"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {statusChange && (
        <Dialog
          title={`${statusChange.isActive ? "Archive" : "Restore"} ${statusChange.label}`}
          onClose={() => {
            setStatusChange(null);
            setError(null);
          }}
        >
          <form onSubmit={submitStatusChange} className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {statusChange.isActive
                ? "This record will no longer appear in new assignments, but existing historical references will remain intact."
                : "This record will become available for new assignments again."}
            </div>
            <PasswordField
              value={statusChange.password}
              onChange={(password) =>
                setStatusChange({ ...statusChange, password })
              }
            />
            {error && (
              <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/5">
              <button
                type="button"
                onClick={() => setStatusChange(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                type="submit"
                className="rounded-xl bg-[#C9A227] px-4 py-2 text-xs font-black text-[#0B3A53] disabled:opacity-60"
              >
                {submitting
                  ? "Confirming..."
                  : `Confirm ${statusChange.isActive ? "archive" : "restore"}`}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
