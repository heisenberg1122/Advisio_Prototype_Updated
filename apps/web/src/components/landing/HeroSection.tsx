import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  FileCheck2,
  Lock,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { HeroProductVisual } from "./HeroProductVisual";

export function HeroSection() {
  return (
    <section id="hero" className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 overflow-hidden bg-gradient-to-b from-[#f8fafc] via-white to-white">
      {/* Subtle Architectural Grid Pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#0b3553_1px,transparent_1px),linear-gradient(90deg,#0b3553_1px,transparent_1px)] [background-size:48px_48px]"
      />

      {/* Ambient Gradient Highlights */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-b from-[#0b3553]/10 to-transparent blur-3xl opacity-60"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero Copy */}
        <div className="mx-auto max-w-4xl text-center">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0b3553]/15 bg-[#0b3553]/5 px-4 py-1.5 text-xs font-bold text-[#0b3553] shadow-2xs backdrop-blur-xs">
            <span className="flex h-2 w-2 rounded-full bg-[#ffad14]" />
            <span>Built for modern academic research workflows</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[#0b3553] sm:text-6xl lg:text-[64px] leading-[1.08] text-balance">
            Research, organized from idea to completion.
          </h1>

          {/* Supporting Copy */}
          <p className="mt-6 text-lg sm:text-xl leading-relaxed text-slate-600 max-w-3xl mx-auto text-balance">
            Advisio brings researchers, advisers, panelists, faculty, and research offices together in one connected workspace. Manage research documents, iterative feedback, consultations, milestones, evaluations, and institutional approvals from a centralized platform.
          </p>

          {/* Call To Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#0b3553] px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#0b3553]/20 hover:bg-[#124569] active:scale-[0.98] transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#solution"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-[#0b3553] hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <span>Explore Advisio</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </a>
          </div>

          {/* Key Value Badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-y-2 gap-x-8 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#ffad14]" />
              <span>Multi-Role Academic Governance</span>
            </span>
            <span className="flex items-center gap-1.5">
              <FileCheck2 className="h-4 w-4 text-[#ffad14]" />
              <span>Versioned Manuscript Review</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-[#ffad14]" />
              <span>Tamper-Evident Document Records</span>
            </span>
          </div>
        </div>

        {/* Live Hero Product Visual Showcase */}
        <div className="mt-14 sm:mt-16">
          <HeroProductVisual />
        </div>
      </div>
    </section>
  );
}
