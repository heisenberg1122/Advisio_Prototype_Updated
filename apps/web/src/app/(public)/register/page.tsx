"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpenCheck, Check, CheckCircle2, Eye, EyeOff, FileCheck2, GraduationCap, IdCard, LockKeyhole, Mail, ShieldCheck, UserRound, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthHero as SharedAuthHero } from "@/components/auth/AuthHero";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

type AccountType = "RESEARCHER" | "ADVISER";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", universityId: "", email: "", password: "", confirmPassword: "" });
  const [role, setRole] = useState<AccountType>("RESEARCHER");
  const [collegeId, setCollegeId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; email: string; id: string; role: string } | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const collegesQuery = useQuery({
    queryKey: ["registration-institutional-units"],
    queryFn: () => apiClient.get<{ colleges: { id: string; name: string }[] }>("/api/colleges"),
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) return setError("Please provide your first and last name.");
    if (!form.universityId.trim()) return setError("University ID is required.");
    if (!form.email.includes("@")) return setError("Enter a valid institutional email address.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters long.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (!agreed) return setError("Please accept the Terms, Privacy Notice, and Research Integrity Policy.");
    setLoading(true);
    try {
      if (!collegeId) return setError("Please select your college or school.");
      const result = await register({ universityId: form.universityId.trim(), email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), password: form.password, role, collegeId });
      if (!result.success) return setError(result.error || "Failed to create account.");
      const identity = { name: `${form.firstName.trim()} ${form.lastName.trim()}`, email: form.email.trim(), universityId: form.universityId.trim() };
      setCreated({ name: identity.name, email: identity.email, id: identity.universityId, role: role === "ADVISER" ? "Faculty Member" : "Researcher" });
      if (role === "RESEARCHER" && result.onboardingToken) {
        sessionStorage.setItem("advisio_researcher_onboarding_token", result.onboardingToken);
        sessionStorage.setItem("advisio_researcher_onboarding_identity", JSON.stringify({ ...identity, collegeId }));
        sessionStorage.setItem("advisio_researcher_onboarding_draft", JSON.stringify({ collegeId }));
        setOnboardingReady(true);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Registration failed."); }
    finally { setLoading(false); }
  };

  return <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] font-sans text-slate-900 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(500px,.92fr)]">
    <SharedAuthHero />
    <section className="relative flex min-h-screen items-center justify-center overflow-y-auto px-5 py-10 sm:px-10 lg:px-[clamp(3rem,6vw,6.5rem)]">
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[#ffb21c]/10 blur-3xl" />
      <div className="w-full max-w-[500px] animate-fade-in-up">
        <MobileBrand />
        {created ? <Success user={created} onboardingReady={onboardingReady} onContinue={() => router.push("/researcher-onboarding")} /> : <>
          <div className="mb-7">
            <div className="mb-5 hidden items-center gap-3 lg:flex"><LogoPair /></div>
            <div className="flex items-end justify-between gap-4"><div><h2 className="text-[32px] font-bold tracking-[-.035em] text-[#102f49]">Create your account</h2><p className="mt-2 text-[14px] text-slate-500">Start your research journey with Advisio.</p></div><span className="mb-1 shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#234863] shadow-sm">Account setup</span></div>
          </div>
          {error && <div role="alert" className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-[12px] text-red-700"><ShieldCheck size={17} className="shrink-0" />{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div><Label>How will you use Advisio?</Label><div className="grid grid-cols-2 gap-2.5"><Role active={role === "RESEARCHER"} icon={<GraduationCap size={18} />} title="Researcher" subtitle="Undergraduate or graduate" onClick={() => setRole("RESEARCHER")} /><Role active={role === "ADVISER"} icon={<BookOpenCheck size={18} />} title="Faculty" subtitle="Institutional member" onClick={() => setRole("ADVISER")} /></div></div>
            <div><Label>College / School</Label><select value={collegeId} onChange={(event) => setCollegeId(event.target.value)} required className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-700 shadow-sm outline-none focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10"><option value="">Select your college or school</option>{collegesQuery.data?.colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select></div>
            <div className="grid gap-4 sm:grid-cols-2"><Input id="first-name" label="First name" icon={<UserRound size={16} />} value={form.firstName} setValue={(v) => set("firstName", v)} placeholder="Maria" /><Input id="last-name" label="Last name" icon={<UserRound size={16} />} value={form.lastName} setValue={(v) => set("lastName", v)} placeholder="Santos" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><Input id="university-id" label={role === "ADVISER" ? "Employee number" : "Researcher ID"} icon={<IdCard size={17} />} value={form.universityId} setValue={(v) => set("universityId", v)} placeholder={role === "ADVISER" ? "FAC-2026-001" : "2026-10025"} /><Input id="reg-email" label="University email" type="email" icon={<Mail size={17} />} value={form.email} setValue={(v) => set("email", v)} placeholder="name@university.edu.ph" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><Password id="reg-password" label="Password" value={form.password} setValue={(v) => set("password", v)} show={showPassword} toggle={() => setShowPassword(!showPassword)} /><Password id="confirm-password" label="Confirm password" value={form.confirmPassword} setValue={(v) => set("confirmPassword", v)} show={showPassword} /></div>
            <p className="-mt-1 text-[10px] text-slate-400">Use at least 8 characters. Avoid reusing your university portal password.</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-[11.5px] leading-5 text-slate-600 shadow-sm"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0c3b5d]" /><span>I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setShowPolicies(true); }} className="font-extrabold text-[#164866] underline hover:text-[#d98600]">Terms, Privacy Notice, and Research Integrity Policy</button>.</span></label>
            <button type="submit" disabled={loading} className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ffad14] text-[13px] font-extrabold text-[#102f49] shadow-[0_10px_25px_rgba(255,173,20,.25)] transition hover:-translate-y-0.5 hover:bg-[#ffb82e] disabled:opacity-60">{loading ? "Creating account…" : <>Create Advisio account <ArrowRight size={17} /></>}</button>
          </form>
          <p className="mt-7 text-center text-[12px] text-slate-500">Already have an account? <Link href="/login" className="font-extrabold text-[#164866] hover:text-[#d98600]">Sign in</Link></p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-slate-400"><ShieldCheck size={13} /> New accounts require institutional verification</div>
        </>}
      </div>
    </section>
    {showPolicies && <Policies close={() => setShowPolicies(false)} accept={() => { setAgreed(true); setShowPolicies(false); }} />}
  </main>;
}

function AuthHero() { return <section className="relative hidden min-h-screen overflow-hidden bg-[#092f4f] px-[clamp(2.5rem,5vw,5.5rem)] py-10 text-white lg:flex lg:flex-col"><div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:48px_48px]" /><div className="pointer-events-none absolute -left-28 top-[38%] h-80 w-80 rounded-full bg-[#ffab19]/20 blur-[100px]" /><header className="relative z-10 flex items-center justify-between"><Brand light /><div className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2"><img src="/school-logo.png" alt="University of the Assumption" className="h-9 w-9 object-contain" /><div><p className="text-[11px] font-bold">University of the Assumption</p><p className="text-[9px] text-slate-300">Academic Research</p></div></div></header><div className="relative z-10 my-auto grid items-center gap-10 xl:grid-cols-[1fr_300px]"><div><h1 className="text-[clamp(2.6rem,4.5vw,4.75rem)] font-bold leading-[1.02] tracking-[-.045em]">Research moves<br />better <span className="text-[#ffb21c]">together.</span></h1><p className="mt-6 max-w-[510px] text-[15px] leading-7 text-slate-300">From first proposal to final defense, keep your team, feedback, and deadlines in one clear place.</p><div className="mt-9 flex gap-2 text-[12px] font-semibold">{["Plan", "Review", "Defend"].map((x, i) => <span key={x} className="rounded-full border border-white/10 bg-white/[.06] px-3 py-2"><b className="mr-2 text-[#ffb21c]">{i + 1}</b>{x}</span>)}</div></div><div className="rounded-[26px] border border-white/15 bg-white/[.09] p-4 shadow-2xl backdrop-blur-xl"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ffb21c]">Research workspace</p><p className="mt-1 font-bold">Capstone progress</p><div className="mt-4 rounded-2xl bg-white p-4 text-[#173e5e]"><div className="flex justify-between text-[11px] font-bold"><span>Chapter 3 review</span><span className="text-[#d98600]">72%</span></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full w-[72%] rounded-full bg-[#ffad14]" /></div><HeroRow icon={<FileCheck2 size={15} />} text="Proposal approved" /><HeroRow icon={<Users size={15} />} text="Adviser review" /></div><div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/10 p-3"><ShieldCheck size={20} className="text-[#ffb21c]" /><div><p className="text-[11px] font-bold">Secure academic workspace</p><p className="text-[9px] text-slate-300">Role-based access for every team</p></div></div></div></div><footer className="relative z-10 flex justify-between border-t border-white/10 pt-5 text-[10px] text-slate-400"><span>University of the Assumption • Research Management System</span><span>ADVISIO • 2026</span></footer></section>; }
function HeroRow({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">{icon}</span><span className="flex-1">{text}</span><Check size={14} className="text-emerald-600" /></div>; }
function Brand({ light = false }: { light?: boolean }) { return <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"><img src="/ao-logo.png" alt="Advisio" className="h-full w-full object-contain" /></div><div><div className={`text-[21px] font-extrabold tracking-[.05em] ${light ? "text-white" : "text-[#092f4f]"}`}>ADVISIO</div><div className="text-[9px] font-bold uppercase tracking-[.28em] text-[#d98600]">Research portal</div></div></div>; }
function MobileBrand() { return <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4 lg:hidden"><Brand /><img src="/school-logo.png" alt="University of the Assumption" className="h-9 w-9" /></div>; }
function LogoPair() { return <><div className="h-12 w-12 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"><img src="/ao-logo.png" alt="Advisio" className="h-full w-full object-contain" /></div><div className="h-7 w-px bg-slate-200" /><div className="h-12 w-12 rounded-2xl border border-slate-200 bg-white p-1"><img src="/school-logo.png" alt="University" className="h-full w-full object-contain" /></div></>; }
function Label({ children }: { children: React.ReactNode }) { return <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.11em] text-[#234863]">{children}</span>; }
function Role({ active, icon, title, subtitle, onClick }: { active: boolean; icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${active ? "border-[#164866] bg-[#eef5f8]" : "border-slate-200 bg-white hover:border-[#ffb21c]"}`}><span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-[#164866] text-[#ffb21c]" : "bg-slate-100 text-slate-500"}`}>{icon}</span><span><b className="block text-[12px] text-[#153d5c]">{title}</b><small className="text-[9px] text-slate-500">{subtitle}</small></span></button>; }
function Input({ id, label, icon, value, setValue, placeholder, type = "text" }: { id: string; label: string; icon: React.ReactNode; value: string; setValue: (v: string) => void; placeholder: string; type?: string }) { return <div><label htmlFor={id} className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.11em] text-[#234863]">{label}</label><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span><input id={id} type={type} required value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[13px] shadow-sm outline-none focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10" /></div></div>; }
function Password({ id, label, value, setValue, show, toggle }: { id: string; label: string; value: string; setValue: (v: string) => void; show: boolean; toggle?: () => void }) { return <div><label htmlFor={id} className="mb-2 block text-[11px] font-extrabold uppercase tracking-[.11em] text-[#234863]">{label}</label><div className="relative"><LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input id={id} type={show ? "text" : "password"} required value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter password" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-[13px] shadow-sm outline-none focus:border-[#e69800] focus:ring-4 focus:ring-[#ffb21c]/10" />{toggle && <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>}</div></div>; }
function Success({ user, onboardingReady, onContinue }: { user: { name: string; email: string; id: string; role: string }; onboardingReady: boolean; onContinue: () => void }) { return <div className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={32} /></div><h2 className="mt-5 text-[28px] font-bold text-[#102f49]">Account created</h2><p className="mt-2 text-[13px] text-slate-500">Welcome, {user.name}. Your {user.role.toLowerCase()} account is pending verification.</p><div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><p className="text-xs text-slate-500">{user.email}</p><p className="mt-1 text-xs font-bold text-[#153d5c]">{user.id}</p></div>{onboardingReady ? <button onClick={onContinue} className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ffad14] text-[13px] font-extrabold text-[#102f49]">Continue researcher onboarding <ArrowRight size={17} /></button> : <Link href="/login" className="mt-6 flex h-13 w-full items-center justify-center rounded-xl bg-[#092f4f] text-[13px] font-bold text-white">Return to sign in</Link>}</div>; }
function Policies({ close, accept }: { close: () => void; accept: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="bg-[#092f4f] p-6 text-white"><h3 className="text-lg font-extrabold">Terms and research policies</h3><p className="mt-1 text-xs text-slate-300">Institutional account agreement</p></div><div className="max-h-[55vh] space-y-4 overflow-y-auto p-6 text-xs leading-6 text-slate-600"><p><b className="text-[#153d5c]">Identity.</b> Account information must match official institutional records.</p><p><b className="text-[#153d5c]">Privacy.</b> Research documents and academic records are protected through role-based access.</p><p><b className="text-[#153d5c]">Research integrity.</b> Users must follow institutional rules for originality, attribution, ethics, and responsible AI use.</p><p><b className="text-[#153d5c]">Confidentiality.</b> Unpublished manuscripts, reviews, and defense records must not be shared without authorization.</p></div><div className="flex justify-end gap-3 border-t bg-slate-50 p-4"><button onClick={close} className="rounded-xl border px-4 py-2.5 text-xs font-bold">Cancel</button><button onClick={accept} className="rounded-xl bg-[#ffad14] px-5 py-2.5 text-xs font-extrabold text-[#102f49]">Accept policies</button></div></div></div>; }
