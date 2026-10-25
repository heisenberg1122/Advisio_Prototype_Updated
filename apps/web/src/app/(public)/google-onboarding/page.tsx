import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap, LoaderCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import {
  resolvePostLoginAction,
  resetOnboardingForSession,
  getRememberedWorkspaceId,
  setRememberedWorkspaceId,
  markOnboardingCompletedInSession,
} from "@/lib/post-login-navigation";

type Program = { id: string; name: string; code: string };
type College = { id: string; name: string; code: string; programs: Program[] };

export default function GoogleOnboardingPage() {
  const navigate = useNavigate();
  const { token, isLoading } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegeId, setCollegeId] = useState("");
  const [programId, setProgramId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !token) navigate("/login", { replace: true });
  }, [isLoading, token, navigate]);

  useEffect(() => {
    apiClient.get<{ colleges: College[] }>("/api/colleges")
      .then((data) => setColleges(data.colleges))
      .catch((err) => setError(err.message || "Unable to load department and course options."))
      .finally(() => setLoadingOptions(false));
  }, []);

  const selectedCollege = colleges.find((college) => college.id === collegeId);
  const programs = useMemo(() => selectedCollege?.programs ?? [], [selectedCollege]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!collegeId || !programId) {
      setError("Choose your department and course to continue.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiClient.patch("/api/auth/google/academic-profile", { collegeId, programId });
      const profileData = await apiClient.get<{ user: any }>("/api/auth/me");
      const meUser = profileData?.user;
      if (meUser?.id) {
        resetOnboardingForSession(meUser.id);
      }
      const action = resolvePostLoginAction({
        roles: meUser?.roles || ["RESEARCHER"],
        needsAcademicSetup: false,
        userId: meUser?.id,
        rememberedWorkspaceId: getRememberedWorkspaceId(meUser?.id),
      });
      if (action.type === "SINGLE_ROLE") {
        if (meUser?.id) {
          markOnboardingCompletedInSession(meUser.id);
          setRememberedWorkspaceId(meUser.id, action.workspace.id);
        }
      }
      navigate(action.url, { replace: true });
    } catch (err: any) {
      setError(err.message || "Could not save your academic details. Please try again.");
      setSaving(false);
    }
  };

  if (isLoading || (!token && !isLoading)) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f7fa]"><LoaderCircle className="animate-spin text-[#164866]" /></main>;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fa] px-4 py-10 text-slate-800">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-[#0c3b5d] px-7 py-7 text-white sm:px-9">
          <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#ffb21c]"><GraduationCap size={23} /></div>
          <p className="text-sm font-extrabold uppercase tracking-[.18em] text-[#ffb21c]">Google account setup</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Set up your academic profile</h1>
          <p className="mt-2 text-base leading-6 text-slate-200">Choose your department and course so we can prepare the right Advisio research workspace.</p>
        </div>

        <form onSubmit={submit} className="space-y-5 p-7 sm:p-9">
          <label className="block">
            <span className="mb-2 block text-xs font-extrabold uppercase tracking-[.12em] text-[#234863]">Department / College</span>
            <select required value={collegeId} disabled={loadingOptions || saving} onChange={(event) => { setCollegeId(event.target.value); setProgramId(""); setError(""); }} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base shadow-sm outline-none transition focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10 disabled:bg-slate-50">
              <option value="">{loadingOptions ? "Loading departments…" : "Select your department"}</option>
              {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-extrabold uppercase tracking-[.12em] text-[#234863]">Course / Program</span>
            <select required value={programId} disabled={!collegeId || saving || loadingOptions} onChange={(event) => { setProgramId(event.target.value); setError(""); }} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base shadow-sm outline-none transition focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10 disabled:bg-slate-50">
              <option value="">{collegeId ? "Select your course" : "Select a department first"}</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.name} ({program.code})</option>)}
            </select>
            {collegeId && programs.length === 0 && <span className="mt-2 block text-xs text-amber-700">No active courses are listed for this department. Contact your administrator.</span>}
          </label>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700">{error}</p>}

          <button type="submit" disabled={loadingOptions || saving || !collegeId || !programId} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ffad14] text-sm font-extrabold text-[#102f49] shadow-[0_10px_25px_rgba(255,173,20,.2)] transition hover:bg-[#ffb82e] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <><LoaderCircle size={16} className="animate-spin" />Saving your profile…</> : <>Continue to Advisio <ArrowRight size={17} /></>}
          </button>
          <p className="text-center text-base leading-5 text-slate-500">Your selection helps scope research groups and academic resources in your workspace.</p>
        </form>
      </section>
    </main>
  );
}
