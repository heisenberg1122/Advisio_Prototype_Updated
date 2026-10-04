"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

type College = { id: string; code: string; name: string; programs: Program[] };
type Program = { id: string; collegeId: string; code: string; name: string };
type AcademicYear = { id: string; name: string; isCurrent: boolean };

type FormState = {
  collegeId: string;
  programId: string;
  academicYearId: string;
  degreeLevel: "" | "UNDERGRADUATE" | "MASTERS" | "DOCTORATE" | "OTHER";
  otherDegreeLevel: string;
  yearLevel: string;
  academicStage: string;
  academicTerm: string;
  researchStatus: string;
  groupSetup: string;
  invitationCode: string;
  tentativeTitle: string;
  researchType: "" | "INDIVIDUAL" | "GROUP";
  interests: string[];
};

const initialForm: FormState = {
  collegeId: "", programId: "", academicYearId: "", degreeLevel: "",
  otherDegreeLevel: "", yearLevel: "", academicStage: "", academicTerm: "",
  researchStatus: "", groupSetup: "SET_UP_LATER", invitationCode: "",
  tentativeTitle: "", researchType: "", interests: [],
};

const steps = ["Academic profile", "Research status", "Group setup", "Research interests", "Review"];
const interestOptions = [
  "Artificial Intelligence", "Information Systems", "Cybersecurity", "Data Analytics",
  "Software Engineering", "Networking", "Educational Technology", "Human–Computer Interaction",
];

export default function ResearcherOnboardingPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [colleges, setColleges] = useState<College[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [identity, setIdentity] = useState<{ name?: string; email?: string; universityId?: string }>({});
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("advisio_researcher_onboarding_draft");
    const savedIdentity = sessionStorage.getItem("advisio_researcher_onboarding_identity");
    if (saved) {
      try { setForm({ ...initialForm, ...JSON.parse(saved) }); } catch { /* ignore malformed local draft */ }
    }
    if (savedIdentity) {
      try { setIdentity(JSON.parse(savedIdentity)); } catch { /* ignore malformed identity */ }
    }

    Promise.all([
      apiClient.get<{ colleges: College[] }>("/api/colleges"),
      apiClient.get<{ academicYears: AcademicYear[] }>("/api/academic-years"),
    ])
      .then(([collegeData, yearData]) => {
        setColleges(collegeData.colleges);
        setAcademicYears(yearData.academicYears);
        const current = yearData.academicYears.find((year) => year.isCurrent);
        if (current) setForm((value) => ({ ...value, academicYearId: value.academicYearId || current.id }));
      })
      .catch((err) => setError(err.message || "Unable to load institutional options."))
      .finally(() => setLoadingMeta(false));
  }, []);

  useEffect(() => {
    sessionStorage.setItem("advisio_researcher_onboarding_draft", JSON.stringify(form));
  }, [form]);

  const selectedCollege = colleges.find((college) => college.id === form.collegeId);
  const selectedProgram = selectedCollege?.programs.find((program) => program.id === form.programId);
  const selectedYear = academicYears.find((year) => year.id === form.academicYearId);

  const academicProfileValid = useMemo(() => {
    const conditionalValid = form.degreeLevel === "UNDERGRADUATE"
      ? Boolean(form.yearLevel)
      : ["MASTERS", "DOCTORATE"].includes(form.degreeLevel)
        ? Boolean(form.academicStage)
        : form.degreeLevel === "OTHER"
          ? Boolean(form.otherDegreeLevel.trim())
          : false;
    return Boolean(form.collegeId && form.programId && form.academicYearId && form.academicTerm && conditionalValid);
  }, [form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const next = () => {
    if (step === 0 && !academicProfileValid) {
      setError("Complete all required academic profile fields before continuing.");
      return;
    }
    if (step === 2 && form.groupSetup === "JOIN_GROUP" && !form.invitationCode.trim()) {
      setError("Enter your research group invitation code.");
      return;
    }
    setError("");
    setStep((value) => Math.min(value + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    const onboardingToken = sessionStorage.getItem("advisio_researcher_onboarding_token");
    if (!onboardingToken) {
      setError("Your onboarding session has expired. Please register again to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/api/auth/researcher-onboarding", {
        onboardingToken,
        ...form,
        otherDegreeLevel: form.otherDegreeLevel || undefined,
        yearLevel: form.yearLevel || undefined,
        academicStage: form.academicStage || undefined,
        researchStatus: form.researchStatus || undefined,
        invitationCode: form.invitationCode || undefined,
        tentativeTitle: form.tentativeTitle || undefined,
        researchType: form.researchType || undefined,
      });
      sessionStorage.removeItem("advisio_researcher_onboarding_token");
      sessionStorage.removeItem("advisio_researcher_onboarding_draft");
      setComplete(true);
    } catch (err: any) {
      setError(err.message || "Unable to submit your researcher profile.");
    } finally {
      setSubmitting(false);
    }
  };

  if (complete) {
    return (
      <main className="min-h-screen bg-[#f4f7fa] flex items-center justify-center p-6">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 md:p-10 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl text-emerald-600">
            <i className="ti ti-circle-check" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600">Profile submitted</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#1b4264]">Your researcher profile is ready for verification</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The administrator will verify your institutional and academic information. You can sign in once your account is approved.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
            <SummaryRow label="Researcher" value={identity.name || "New researcher"} />
            <SummaryRow label="Program" value={selectedProgram?.name || "Selected program"} />
            <SummaryRow label="Status" value="Pending administrator verification" />
          </div>
          <Link href="/login" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#1b4264] px-5 py-3 text-sm font-bold text-white hover:bg-[#15344f]">
            Return to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fa] text-slate-800">
      <header className="border-b border-[#15344f] bg-[#1b4264] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#ffa400]"><i className="ti ti-school text-xl" /></div>
            <div><strong className="block tracking-tight">ADVISIO</strong><span className="text-[10px] font-semibold uppercase tracking-widest text-[#ffa400]">Researcher onboarding</span></div>
          </div>
          <div className="hidden text-right text-xs text-slate-300 sm:block"><strong className="block text-white">{identity.name || "New researcher"}</strong>{identity.email}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-8 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-2xl bg-[#1b4264] p-5 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffa400]">Profile setup</p>
          <h1 className="mt-2 text-xl font-extrabold">Tell us about your research journey</h1>
          <p className="mt-2 text-xs leading-5 text-slate-300">Your answers connect you with the correct program, workflow, group tools, and adviser pool.</p>
          <nav className="mt-6 space-y-1" aria-label="Onboarding progress">
            {steps.map((label, index) => (
              <button key={label} type="button" onClick={() => index < step && setStep(index)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${index === step ? "bg-white/12 text-white" : index < step ? "text-slate-200 hover:bg-white/5" : "cursor-default text-slate-500"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${index < step ? "bg-emerald-500 text-white" : index === step ? "bg-[#ffa400] text-[#1b4264]" : "bg-white/10 text-slate-400"}`}>{index < step ? <i className="ti ti-check" /> : index + 1}</span>
                <span className="font-semibold">{label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ffa400] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
          <p className="mt-2 text-right text-[10px] text-slate-400">Step {step + 1} of {steps.length}</p>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-6 py-5 md:px-8">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#e09000]">Step {step + 1}</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1b4264]">{steps[step]}</h2>
            <p className="mt-1 text-sm text-slate-500">{stepDescription(step)}</p>
          </div>

          <div className="min-h-[430px] p-6 md:p-8">
            {loadingMeta && step === 0 ? <Loading /> : (
              <>
                {step === 0 && <AcademicProfile form={form} update={update} colleges={colleges} academicYears={academicYears} />}
                {step === 1 && <ResearchStatus form={form} update={update} />}
                {step === 2 && <GroupSetup form={form} update={update} />}
                {step === 3 && <ResearchInterests form={form} update={update} />}
                {step === 4 && <Review form={form} college={selectedCollege} program={selectedProgram} academicYear={selectedYear} identity={identity} edit={setStep} />}
              </>
            )}
            {error && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><i className="ti ti-alert-circle mt-0.5" /><span>{error}</span></div>}
          </div>

          <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4 md:px-8">
            <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:invisible">Back</button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={next} className="rounded-xl bg-[#1b4264] px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-[#15344f]">Continue <i className="ti ti-arrow-right ml-1" /></button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="rounded-xl bg-[#ffa400] px-6 py-2.5 text-sm font-extrabold text-[#1b4264] shadow hover:bg-[#e09000] disabled:opacity-60">{submitting ? "Submitting profile…" : "Submit for verification"}</button>
            )}
          </footer>
        </section>
      </div>
    </main>
  );
}

function AcademicProfile({ form, update, colleges, academicYears }: { form: FormState; update: any; colleges: College[]; academicYears: AcademicYear[] }) {
  const programs = colleges.find((college) => college.id === form.collegeId)?.programs || [];
  return <div className="grid gap-5 md:grid-cols-2">
    <Field label="College / Graduate School" required><Select value={form.collegeId} onChange={(e) => { update("collegeId", e.target.value); update("programId", ""); }}><option value="">Select college</option>{colleges.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
    <Field label="Degree level" required><Select value={form.degreeLevel} onChange={(e) => update("degreeLevel", e.target.value)}><option value="">Select degree level</option><option value="UNDERGRADUATE">Undergraduate</option><option value="MASTERS">Master's</option><option value="DOCTORATE">Doctorate</option><option value="OTHER">Other</option></Select></Field>
    <Field label="Program" required hint={!form.collegeId ? "Choose a college first" : undefined}><Select value={form.programId} disabled={!form.collegeId} onChange={(e) => update("programId", e.target.value)}><option value="">Select program</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</Select></Field>
    {form.degreeLevel === "UNDERGRADUATE" && <Field label="Year level" required><Select value={form.yearLevel} onChange={(e) => update("yearLevel", e.target.value)}><option value="">Select year level</option>{[1,2,3,4,5].map((year) => <option key={year} value={`YEAR_${year}`}>{ordinal(year)} Year</option>)}</Select></Field>}
    {["MASTERS", "DOCTORATE"].includes(form.degreeLevel) && <Field label="Current academic stage" required><Select value={form.academicStage} onChange={(e) => update("academicStage", e.target.value)}><option value="">Select current stage</option><option value="COURSEWORK">Coursework</option><option value="PROPOSAL">Proposal</option><option value="THESIS_CAPSTONE">Thesis / Dissertation</option><option value="DEFENSE">Defense</option><option value="FINAL_REVISION">Final revision</option></Select></Field>}
    {form.degreeLevel === "OTHER" && <Field label="Specify degree level" required><Input value={form.otherDegreeLevel} onChange={(e) => update("otherDegreeLevel", e.target.value)} placeholder="Enter degree or research level" /></Field>}
    <Field label="Academic year" required><Select value={form.academicYearId} onChange={(e) => update("academicYearId", e.target.value)}><option value="">Select academic year</option>{academicYears.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? " (Current)" : ""}</option>)}</Select></Field>
    <Field label="Semester / Term" required><Select value={form.academicTerm} onChange={(e) => update("academicTerm", e.target.value)}><option value="">Select term</option><option value="FIRST_SEMESTER">First semester</option><option value="SECOND_SEMESTER">Second semester</option><option value="SUMMER">Summer</option><option value="FIRST_TRIMESTER">First trimester</option><option value="SECOND_TRIMESTER">Second trimester</option><option value="THIRD_TRIMESTER">Third trimester</option></Select></Field>
  </div>;
}

function ResearchStatus({ form, update }: { form: FormState; update: any }) {
  const choices = [["NOT_STARTED", "I have not started", "I am still exploring topics or waiting for instructions."], ["PREPARING_PROPOSAL", "Preparing a proposal", "I am developing a topic, concept paper, or proposal."], ["HAS_PROJECT", "I already have a project", "I have a working title or an active study."], ["INVITED_TO_GROUP", "Invited to a research group", "I received or expect to receive a group invitation."]];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2">{choices.map(([value,title,description]) => <Choice key={value} selected={form.researchStatus === value} title={title} description={description} onClick={() => update("researchStatus", value)} />)}</div>{form.researchStatus === "HAS_PROJECT" && <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2"><Field label="Tentative research title"><Input value={form.tentativeTitle} onChange={(e) => update("tentativeTitle", e.target.value)} placeholder="Working title (can be changed later)" /></Field><Field label="Research arrangement"><Select value={form.researchType} onChange={(e) => update("researchType", e.target.value)}><option value="">Not decided</option><option value="INDIVIDUAL">Individual</option><option value="GROUP">Group</option></Select></Field></div>}<SkipNote>This information is optional and can be updated from your researcher profile later.</SkipNote></div>;
}

function GroupSetup({ form, update }: { form: FormState; update: any }) {
  const choices = [["CREATE_GROUP", "Create a research group", "Start a new workspace and invite members after approval."], ["JOIN_GROUP", "Join with an invitation code", "Connect this profile to an existing research group."], ["INDIVIDUAL", "Continue as an individual", "Use Advisio for an individual thesis or study."], ["SET_UP_LATER", "Set this up later", "Continue onboarding without choosing a group."]];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2">{choices.map(([value,title,description]) => <Choice key={value} selected={form.groupSetup === value} title={title} description={description} onClick={() => update("groupSetup", value)} />)}</div>{form.groupSetup === "JOIN_GROUP" && <div className="rounded-2xl border border-[#ffa400]/40 bg-amber-50 p-5"><Field label="Group invitation code" required><Input value={form.invitationCode} onChange={(e) => update("invitationCode", e.target.value.toUpperCase())} placeholder="Example: ADV-7H3K9" /></Field></div>}<SkipNote>Creating or joining a group will only take effect after your researcher account is approved.</SkipNote></div>;
}

function ResearchInterests({ form, update }: { form: FormState; update: any }) {
  const toggle = (interest: string) => update("interests", form.interests.includes(interest) ? form.interests.filter((item) => item !== interest) : [...form.interests, interest]);
  return <div><p className="mb-4 text-sm text-slate-600">Select up to 10 areas. Advisio can use these to improve adviser and research-resource recommendations.</p><div className="flex flex-wrap gap-2">{interestOptions.map((interest) => <button key={interest} type="button" onClick={() => toggle(interest)} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${form.interests.includes(interest) ? "border-[#1b4264] bg-[#1b4264] text-white" : "border-slate-300 bg-white text-slate-600 hover:border-[#ffa400]"}`}>{form.interests.includes(interest) && <i className="ti ti-check mr-1" />}{interest}</button>)}</div><SkipNote>This step is optional. Interests do not limit which advisers or research topics you can choose.</SkipNote></div>;
}

function Review({ form, college, program, academicYear, identity, edit }: { form: FormState; college?: College; program?: Program; academicYear?: AcademicYear; identity: any; edit: (step: number) => void }) {
  return <div className="space-y-4">
    <ReviewSection title="Account" onEdit={() => undefined} locked><SummaryRow label="Researcher" value={identity.name || "New researcher"} /><SummaryRow label="Institutional email" value={identity.email || "Provided during registration"} /><SummaryRow label="Researcher ID" value={identity.universityId || "Provided during registration"} /></ReviewSection>
    <ReviewSection title="Academic profile" onEdit={() => edit(0)}><SummaryRow label="College" value={college?.name || "—"} /><SummaryRow label="Program" value={program?.name || "—"} /><SummaryRow label="Degree level" value={pretty(form.degreeLevel)} /><SummaryRow label="Academic year and term" value={`${academicYear?.name || "—"} · ${pretty(form.academicTerm)}`} /></ReviewSection>
    <ReviewSection title="Research setup" onEdit={() => edit(1)}><SummaryRow label="Research status" value={pretty(form.researchStatus) || "Not provided"} /><SummaryRow label="Group setup" value={pretty(form.groupSetup)} /><SummaryRow label="Interests" value={form.interests.join(", ") || "Not provided"} /></ReviewSection>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong className="block">Before you submit</strong>Confirm that the academic information is accurate. Your profile will remain pending until an administrator verifies it.</div>
  </div>;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[#1b4264]">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}{hint && <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>}</label>; }
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#ffa400] focus:ring-2 focus:ring-[#ffa400]/20" />; }
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#ffa400] focus:ring-2 focus:ring-[#ffa400]/20 disabled:bg-slate-100 disabled:text-slate-400" />; }
function Choice({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-[#1b4264] bg-[#1b4264]/5 shadow-sm" : "border-slate-200 hover:border-[#ffa400] hover:bg-amber-50/40"}`}><span className="flex items-start gap-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#1b4264] bg-[#1b4264] text-white" : "border-slate-300"}`}>{selected && <i className="ti ti-check text-xs" />}</span><span><strong className="block text-sm text-[#1b4264]">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span></span></button>; }
function SkipNote({ children }: { children: React.ReactNode }) { return <div className="mt-5 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><i className="ti ti-info-circle mt-0.5 text-[#1b4264]" /><span>{children}</span></div>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-2.5 last:border-0"><span className="text-xs text-slate-500">{label}</span><strong className="max-w-[65%] text-right text-xs text-slate-800">{value}</strong></div>; }
function ReviewSection({ title, onEdit, locked, children }: { title: string; onEdit: () => void; locked?: boolean; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 p-4"><div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-extrabold text-[#1b4264]">{title}</h3>{!locked && <button type="button" onClick={onEdit} className="text-xs font-bold text-[#1b4264] underline hover:text-[#e09000]">Edit</button>}</div>{children}</section>; }
function Loading() { return <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-sm text-slate-500"><span className="h-9 w-9 animate-spin rounded-full border-4 border-[#1b4264] border-t-transparent" />Loading academic options…</div>; }
function pretty(value: string) { return value ? value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : ""; }
function ordinal(value: number) { return `${value}${value === 1 ? "st" : value === 2 ? "nd" : value === 3 ? "rd" : "th"}`; }
function stepDescription(step: number) { return ["Connect your account to the correct college, degree, program, and academic cycle.", "Tell us where you are in the research process. You can update this later.", "Choose how you plan to work. Group setup can be completed after approval.", "Optional interests help Advisio make more relevant recommendations.", "Confirm your details before sending your profile for verification."][step]; }
