import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";

export function FinalCtaSection() {
  return (
    <section className="landing-final-cta relative py-24 sm:py-32 bg-white overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#0b3553] px-6 py-16 sm:px-12 sm:py-20 lg:p-24 shadow-2xl">
          {/* Subtle Geometric Background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:40px_40px]"
          />

          {/* Golden Ambient Glows */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#ffad14]/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#164866]/50 blur-3xl"
          />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#ffb82e] backdrop-blur-xs">
              <Sparkles className="h-4 w-4" />
              <span>Modern Academic Research Operations</span>
            </div>

            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl text-balance">
              Make research management simpler.
            </h2>

            <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-200">
              Transform how your university advises student research, tracks manuscript iterations, conducts live oral defense evaluations, and archives official academic records.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#ffad14ff] px-7 py-4 text-sm font-extrabold text-[#0b3553] shadow-lg shadow-[#ffad14]/25 hover:bg-[#ffb82e] active:scale-[0.98] transition-all"
              >
                <span>Request an Account</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-4 text-sm font-bold text-white hover:bg-white/15 transition-colors"
              >
                <span>Sign In to Your Workspace</span>
              </Link>
            </div>

            {/* Trust Badges Row */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-y-3 gap-x-8 text-xs font-semibold text-slate-300 border-t border-white/15 pt-8">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#ffad14]" />
                <span>Connected Research Workspaces</span>
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#ffad14]" />
                <span>Google Sign-In When Enabled</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#ffad14]" />
                <span>Role-Based Workspace Access</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
