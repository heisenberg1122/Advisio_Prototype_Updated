import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Bell, BookOpenCheck, CalendarDays, CheckCircle2,
  ChevronRight, CircleUserRound, FileText, LayoutDashboard,
  LockKeyhole, Mail, MousePointer2, Pause, Play, RotateCcw,
  Search, UsersRound,
} from "lucide-react";
import "./walkthrough.css";

const TOTAL_SECONDS = 16;
const chapters = [
  { label: "Login screen", start: 0, end: 3 },
  { label: "Sign in", start: 3, end: 8 },
  { label: "View dashboard", start: 8, end: TOTAL_SECONDS },
];
const metrics = [
  { label: "Research progress", value: "68%", note: "+12% this month", icon: BookOpenCheck, tone: "navy" },
  { label: "Pending tasks", value: "4", note: "2 due this week", icon: FileText, tone: "amber" },
  { label: "Team members", value: "5", note: "All active", icon: UsersRound, tone: "green" },
];

export default function ResearchDashboardWalkthrough() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setElapsed((current) => {
      if (current >= TOTAL_SECONDS) { setPlaying(false); return TOTAL_SECONDS; }
      return Math.min(current + 0.05, TOTAL_SECONDS);
    }), 50);
    return () => window.clearInterval(timer);
  }, [playing]);

  const chapter = useMemo(() => chapters.findIndex(({ start, end }) => elapsed >= start && elapsed < end), [elapsed]);
  const activeChapter = chapter === -1 ? chapters.length - 1 : chapter;
  const signingIn = elapsed >= 6.6 && elapsed < 8;
  const dashboardVisible = elapsed >= 8;
  const emailVisible = elapsed >= 3.2 ? "name@university.edu.ph" : "";
  const passwordVisible = elapsed >= 4.7 ? "•••••••••••" : "";
  const restart = () => { setElapsed(0); setPlaying(true); };
  const jumpTo = (start: number) => { setElapsed(start + 0.05); setPlaying(true); };

  return (
    <main className="rdw-root">
      <header className="rdw-topbar">
        <div className="rdw-brand"><span className="rdw-brandmark"><img src="/ao-logo.png" alt="" /></span><span><strong>ADVISIO</strong><small>Product walkthrough</small></span></div>
        <div className="rdw-topbar-title"><span>Research Dashboard</span><small>Getting started</small></div>
        <div className="rdw-topbar-actions">
          <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}{playing ? "Pause" : "Play"}</button>
          <button type="button" onClick={restart}><RotateCcw size={15} />Restart</button>
        </div>
      </header>

      <section className="rdw-stage" aria-live="polite">
        <div className={`rdw-browser ${dashboardVisible ? "is-dashboard" : "is-login"}`}>
          <div className="rdw-browserbar"><div className="rdw-window-dots"><i /><i /><i /></div><div className="rdw-address"><LockKeyhole size={12} /> advisio.ua.edu.ph/{dashboardVisible ? "student/dashboard" : "login"}</div><div className="rdw-browser-menu">•••</div></div>

          <div className={`rdw-scene rdw-login-scene ${dashboardVisible ? "is-hidden" : ""}`}>
            <section className="rdw-login-story">
              <div className="rdw-login-grid" />
              <div className="rdw-story-brand"><img src="/ao-logo.png" alt="Advisio" /><span><b>ADVISIO</b><small>Research portal</small></span></div>
              <div className="rdw-story-copy"><p>UNIVERSITY RESEARCH, SIMPLIFIED</p><h1>Research moves<br />better <em>together.</em></h1><span>From first proposal to final defense, keep your team, feedback, and deadlines in one clear place.</span><div className="rdw-story-steps"><b>1</b> Plan <i /><b>2</b> Review <i /><b>3</b> Defend</div></div>
              <div className="rdw-research-card"><small>RESEARCH WORKSPACE</small><strong>Capstone progress</strong><div><span>Chapter 3 review</span><b>72%</b></div><progress max="100" value="72" /><p><CheckCircle2 size={14} /> Proposal approved</p><p><CheckCircle2 size={14} /> Adviser review</p><p><CalendarDays size={14} /> Defense schedule</p></div>
            </section>
            <section className="rdw-login-form"><div className="rdw-form-wrap">
              <div className="rdw-form-logos"><img src="/ao-logo.png" alt="" /><i /><img src="/school-logo.png" alt="" /></div><h2>Welcome back</h2><p>Sign in to continue your research journey.</p>
              <label>UNIVERSITY EMAIL</label><div className={`rdw-input ${emailVisible ? "is-filled" : ""}`}><Mail size={16} /><span>{emailVisible || "name@university.edu.ph"}</span>{emailVisible && <i className="rdw-caret" />}</div>
              <div className="rdw-password-label"><label>PASSWORD</label><span>Forgot password?</span></div><div className={`rdw-input ${passwordVisible ? "is-filled" : ""}`}><LockKeyhole size={16} /><span>{passwordVisible || "Enter your password"}</span></div>
              <div className="rdw-remember"><i /> Keep me signed in on this device</div><button className={signingIn ? "is-loading" : ""} type="button">{signingIn ? <><span className="rdw-spinner" /> Signing in…</> : <>Sign in to Advisio <ArrowRight size={16} /></>}</button>
            </div></section>
            <div className={`rdw-cursor ${elapsed >= 2.8 ? "is-active" : ""}`}><MousePointer2 size={25} fill="white" /></div><div className={`rdw-click-ring ${signingIn ? "is-active" : ""}`} />
          </div>

          <div className={`rdw-scene rdw-dashboard-scene ${dashboardVisible ? "is-visible" : ""}`}>
            <aside className="rdw-sidebar"><div className="rdw-side-brand"><img src="/ao-logo.png" alt="" /><span><b>ADVISIO</b><small>Research portal</small></span></div><nav><small>WORKSPACE</small><a className="active"><LayoutDashboard size={16} /> Dashboard</a><a><BookOpenCheck size={16} /> My research</a><a><FileText size={16} /> Documents</a><a><UsersRound size={16} /> Research group</a><small>ACADEMIC</small><a><CalendarDays size={16} /> Consultations</a><a><CheckCircle2 size={16} /> Milestones</a></nav><div className="rdw-side-profile"><span>JR</span><p><b>Juan Reyes</b><small>Lead Researcher</small></p><ChevronRight size={14} /></div></aside>
            <section className="rdw-dashboard-main"><div className="rdw-dashbar"><div><Search size={15} /> Search your workspace…</div><button><Bell size={17} /><i /></button><span><CircleUserRound size={23} /></span></div><div className="rdw-dash-content">
              <div className="rdw-welcome"><div><small>FRIDAY, OCTOBER 9</small><h2>Good morning, Juan.</h2><p>Here’s what’s happening with your research today.</p></div><button>Open research workspace <ArrowRight size={15} /></button></div>
              <div className="rdw-metrics">{metrics.map(({ label, value, note, icon: Icon, tone }, index) => <article key={label} style={{ "--delay": `${index * 120}ms` } as React.CSSProperties}><span className={tone}><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>)}</div>
              <div className="rdw-dashboard-grid"><article className="rdw-project-panel"><div className="rdw-panel-head"><div><small>ACTIVE RESEARCH</small><h3>AI-Powered Academic Advising System</h3></div><span>IN PROGRESS</span></div><div className="rdw-progress-row"><div><b>Overall research progress</b><small>8 of 12 milestones complete</small></div><strong>68%</strong></div><div className="rdw-progress"><i /></div><div className="rdw-milestones"><p><CheckCircle2 /> Proposal approval <small>Completed</small></p><p><CheckCircle2 /> Chapter 2 review <small>Completed</small></p><p className="current"><span>3</span> Chapter 3 methodology <small>In review</small></p></div></article>
              <article className="rdw-deadlines"><div className="rdw-panel-head"><div><small>UPCOMING</small><h3>Deadlines</h3></div><CalendarDays size={18} /></div><p><b>14</b><span><strong>Chapter 3 revision</strong><small>Monday · 11:59 PM</small></span></p><p><b>18</b><span><strong>Adviser consultation</strong><small>Friday · 2:30 PM</small></span></p><p><b>25</b><span><strong>Pre-oral defense</strong><small>Friday · 9:00 AM</small></span></p></article></div>
            </div></section><div className="rdw-dashboard-sheen" />
          </div>
        </div>
        <div className="rdw-caption"><small>STEP {activeChapter + 1} OF {chapters.length}</small><strong>{chapters[activeChapter].label}</strong><span>{activeChapter === 0 ? "Open the Advisio Research Portal." : activeChapter === 1 ? "Enter your university credentials and securely sign in." : "Your research progress, tasks, team, and deadlines—all in one view."}</span></div>
      </section>

      <footer className="rdw-timeline"><div className="rdw-progress-track"><i style={{ width: `${(elapsed / TOTAL_SECONDS) * 100}%` }} /></div><div className="rdw-chapters">{chapters.map((item, index) => <button type="button" key={item.label} className={index === activeChapter ? "active" : index < activeChapter ? "done" : ""} onClick={() => jumpTo(item.start)}><span>{index < activeChapter ? <CheckCircle2 size={14} /> : index + 1}</span><b>{item.label}</b><small>{item.start.toString().padStart(2, "0")}:00</small></button>)}</div><div className="rdw-time">00:{Math.floor(elapsed).toString().padStart(2, "0")} / 00:{TOTAL_SECONDS}</div></footer>
    </main>
  );
}
