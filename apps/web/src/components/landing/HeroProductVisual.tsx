import React, { useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Award,
  Video,
  ChevronRight,
  ShieldCheck,
  Bell,
  ArrowUpRight,
} from "lucide-react";

export function HeroProductVisual() {
  const [activeTab, setActiveTab] = useState("Dashboard");

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Ambient Backlight Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-r from-[#0b3553]/15 via-[#1a5a8a]/20 to-[#c9a227]/15 blur-2xl opacity-70"
      />

      {/* Main Browser / Application Mockup Container */}
      <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-[#0b3553]/12 overflow-hidden transition-all duration-300">
        {/* Browser Top Window Bar */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
            <span className="ml-3 hidden sm:inline-block font-mono text-xs font-semibold text-slate-500">
              Interactive product preview · Sample data
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Synced Workspace</span>
            </span>
          </div>
        </div>

        {/* Inner Dashboard Layout: Sidebar + Main Stage */}
        <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] bg-[#f8fafc]">
          {/* Mock Sidebar */}
          <aside className="hidden md:flex flex-col border-r border-slate-200/80 bg-slate-50/60 p-4 justify-between">
            <div>
              {/* Brand mark in mockup */}
              <div className="flex items-center gap-2.5 px-2 mb-6">
                <div className="h-7 w-7 rounded-lg bg-[#0b3553] flex items-center justify-center text-white text-xs font-black">
                  A
                </div>
                <div>
                  <span className="font-extrabold text-xs tracking-tight text-[#0b3553] block leading-none">
                    ADVISIO
                  </span>
                  <span className="text-[9px] font-bold text-[#b8860b] uppercase tracking-wider">
                    Researcher
                  </span>
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {[
                  { name: "Dashboard", icon: LayoutDashboard },
                  { name: "My Research", icon: BookOpen },
                  { name: "Documents", icon: FileText, badge: "3" },
                  { name: "Consultations", icon: Clock },
                  { name: "Calendar", icon: Calendar },
                  { name: "Feedback", icon: MessageSquare },
                  { name: "Evaluations", icon: Award },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setActiveTab(item.name)}
                      aria-pressed={isActive}
                      className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[#0b3553] text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.name}</span>
                      </span>
                      {item.badge && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar User Profile Card */}
            <div className="border-t border-slate-200/80 pt-3 flex items-center gap-2.5 px-1">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#0b3553] to-[#1e5f8f] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                NS
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-800 truncate">
                  Nicole Santos
                </span>
                <span className="block text-[10px] text-slate-500 truncate">
                  Lead Researcher
                </span>
              </div>
            </div>
          </aside>

          {/* Main Dashboard Stage */}
          <div className="p-4 sm:p-6 lg:p-7 flex flex-col gap-5 bg-white">
            {/* Topbar Inside Mockup */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#0b3553]">
                  Research Progress Workspace
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-[#0b3553] tracking-tight">
                  Good morning, Nicole
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-xs text-slate-400 w-44">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Search tasks...</span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 relative">
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#ffad14]" />
                </div>
              </div>
            </div>

            {/* Active Research Project Card */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/70 via-white to-blue-50/30 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#b8860b] uppercase tracking-wide">
                    <span>Active Thesis Track</span>
                    <span>·</span>
                    <span>IT-CAPSTONE-2026</span>
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#0b3553] mt-1 leading-snug">
                    Advisio: A Research Advising and Management Platform
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    On Schedule
                  </span>
                </div>
              </div>

              {/* Progress Bar & Stage */}
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">
                    Current Milestone: <strong className="text-[#0b3553]">Chapter 3 / Methodology</strong>
                  </span>
                  <span className="font-mono font-bold text-[#0b3553] tabular-nums">
                    72% Complete
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0b3553] via-[#1a5a8a] to-[#ffad14] transition-all duration-500"
                    style={{ width: "72%" }}
                  />
                </div>
              </div>

              {/* Meta Grid: Adviser & Consultation */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-200/70 pt-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#0b3553]/10 text-[#0b3553] flex items-center justify-center font-bold">
                    EV
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                      Assigned Adviser
                    </span>
                    <strong className="text-slate-800 font-bold block">
                      Dr. Evelyn Vance, Ph.D.
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                      Next Consultation
                    </span>
                    <strong className="text-slate-800 font-bold block">
                      Oct 29, 2026 · 2:00 PM
                    </strong>
                  </div>
                </div>
              </div>

              {/* Recent Feedback Callout */}
              <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 block">
                    Recent Adviser Feedback (Chapter 3 Draft v1.2):
                  </span>
                  <p className="text-amber-800/90 mt-0.5 italic">
                    &ldquo;Please revise the sampling procedure before the next consultation. Ensure stratified random sampling parameters are documented.&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* Upcoming Requirements Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { title: "Adviser Consultation", date: "Thu, Oct 29", icon: Video, color: "text-blue-600 bg-blue-50" },
                { title: "Document Review", date: "Mon, Nov 02", icon: FileCheck2, color: "text-emerald-600 bg-emerald-50" },
                { title: "Research Presentation", date: "Fri, Nov 13", icon: Award, color: "text-purple-600 bg-purple-50" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3"
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 truncate">
                        {item.title}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {item.date}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Micro-Cards to Make Workspace Feel Alive */}
      {/* Floating Card 1: Document Approved */}
      <div className="absolute -top-6 -left-4 sm:-left-6 hidden sm:flex items-center gap-3 rounded-xl border border-emerald-200 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-emerald-900/10 backdrop-blur-md animate-fade-in">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
            Milestone Approved
          </span>
          <span className="text-xs font-bold text-slate-800 block">
            Chapter 2: Lit Review
          </span>
        </div>
      </div>

      {/* Floating Card 2: New Adviser Feedback */}
      <div className="absolute -bottom-5 -right-3 sm:-right-6 hidden sm:flex items-center gap-3 rounded-xl border border-blue-200 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-blue-900/10 backdrop-blur-md animate-fade-in">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b3553] text-[#ffad14] shadow-xs">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0b3553] block">
            New Feedback
          </span>
          <span className="text-xs font-bold text-slate-800 block">
            3 Annotations on Chapter 3
          </span>
        </div>
      </div>

      {/* Floating Card 3: Consultation Scheduled */}
      <div className="absolute top-1/2 -right-6 hidden lg:flex items-center gap-3 rounded-xl border border-amber-200 bg-white/95 px-3 py-2 shadow-lg shadow-amber-900/10 backdrop-blur-md">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white">
          <Video className="h-3.5 w-3.5" />
        </div>
        <div className="text-left">
          <span className="text-[9px] font-bold text-amber-800 uppercase block">
            Google Meet Ready
          </span>
          <span className="text-xs font-bold text-slate-800 block">
            Oct 29 · 2:00 PM
          </span>
        </div>
      </div>
    </div>
  );
}
