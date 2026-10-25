import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, Users } from "lucide-react";
import PublicLayout from "@/components/public/PublicLayout";

export default function HomePage() {
  return (
    <PublicLayout title="Academic research, connected">
      <section className="bg-[#0b3553] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.3fr_1fr] lg:py-28">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#f3b327]">The Advisio research workspace</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">From your first proposal to your final defense.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Advisio helps university researchers, advisers, panelists, and academic administrators coordinate research projects, review manuscripts, and keep academic requirements moving in one shared workspace.</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link to="/login" className="inline-flex items-center gap-3 rounded-xl bg-[#ffad14] px-6 py-4 font-bold text-[#102f49] hover:bg-[#ffb82e]">Open your workspace <ArrowRight size={18} /></Link>
              <Link to="/register" className="rounded-xl border border-white/30 px-6 py-4 font-semibold hover:bg-white/10">Request an account</Link>
            </div>
            <p className="mt-5 text-sm text-slate-300">Workspace access is subject to your institution’s account and role permissions.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f3b327]">A clearer research journey</p>
            {[
              ["01", "Plan together", "Organize research groups, milestones, and team responsibilities."],
              ["02", "Review and refine", "Submit documents, receive faculty feedback, and track revisions."],
              ["03", "Prepare for defense", "Coordinate schedules, panel reviews, and final requirements."],
            ].map(([number, title, description]) => (
              <div key={number} className="mt-7 flex gap-5 border-t border-white/15 pt-6">
                <span className="font-mono text-sm text-[#f3b327]">{number}</span>
                <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 leading-7 text-slate-300">{description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-6 py-16">
        <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-[#0b3553]">One place for the work behind your research.</h2>
        <div className="mt-9 grid gap-6 md:grid-cols-3">
          {[
            { icon: BookOpen, title: "Projects & documents", text: "Keep manuscripts, submission versions, and project milestones organized throughout the research lifecycle." },
            { icon: Users, title: "Advising & review", text: "Connect research teams with advisers and reviewers through consultations, feedback, and academic approvals." },
            { icon: CalendarDays, title: "Schedules & coordination", text: "Follow deadlines, arrange consultations and defense sessions, and keep up with project notifications." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-7">
              <Icon size={26} className="text-[#164866]" aria-hidden="true" />
              <h3 className="mt-5 text-lg font-bold text-[#0b3553]">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-[#0b3553]">Your Google connection, explained.</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600">You can use Google to sign in when enabled. Separately, an authorized administrator can connect Google Drive for research document storage. Google Calendar integration supports consultation and meeting scheduling when configured. Each integration uses the permissions granted for its purpose.</p>
          <p className="mt-4 leading-7 text-slate-600">Read our <Link to="/privacy-policy" className="font-semibold text-[#164866] underline">privacy policy</Link> to understand how data is handled and our <Link to="/terms-of-service" className="font-semibold text-[#164866] underline">terms of service</Link> before using Advisio.</p>
        </div>
      </section>
    </PublicLayout>
  );
}
