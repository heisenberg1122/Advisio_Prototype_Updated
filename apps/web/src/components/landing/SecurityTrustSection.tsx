import React from "react";
import {
  ShieldCheck,
  Lock,
  FileCheck2,
  Database,
  Key,
  CheckCircle2,
  FileText,
  BadgeCheck,
} from "lucide-react";

export function SecurityTrustSection() {
  const securityPillars = [
    {
      icon: Lock,
      title: "Granular Role-Based Access Control (RBAC)",
      description: "Strict isolation ensures students only access their research group, advisers view their assigned cohorts, and panelists see blind or endorsed defense manuscripts only when authorized.",
    },
    {
      icon: Database,
      title: "Cryptographic Integrity Ledger",
      description: "Document fingerprints support integrity checks so reviewers can identify changes to recorded submission versions.",
    },
    {
      icon: FileCheck2,
      title: "Academic Activity Records",
      description: "Activity records help teams follow document submissions, reviews, evaluations, and approvals throughout the research workflow.",
    },
    {
      icon: Key,
      title: "Privacy & Account Permissions",
      description: "Workspace access follows account roles and institutional permissions. Our privacy policy explains how research data and connected Google services are handled.",
    },
  ];

  return (
    <section id="security" className="relative py-24 sm:py-32 bg-[#082236] text-white overflow-hidden">
      {/* Background Architectural Grid Pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      {/* Ambient Radial Accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-[#ffad14]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#ffad14] backdrop-blur-xs">
            <ShieldCheck className="h-4 w-4" />
            <span>Research Governance & Compliance</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-white text-balance">
            Institutional-grade security and research integrity.
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-300">
            Engineered to safeguard university intellectual property, ensure transparent academic assessments, and provide a traceable history of research activity.
          </p>
        </div>

        {/* 2-Column Layout: Pillars + Cryptographic Mockup */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Security Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {securityPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xs hover:border-[#ffad14]/40 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#ffad14]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Cryptographic Ledger & Official Certificate Mockup */}
          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
            <div className="flex flex-wrap gap-3 items-center justify-between border-b border-white/15 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs font-bold text-slate-200">
                  SAMPLE ARCHIVE VERIFICATION RECORD
                </span>
              </div>
              <span className="rounded-md bg-[#ffad14]/20 px-2 py-0.5 text-[11px] font-bold text-[#ffb82e] border border-[#ffad14]/30">
                Institutional Stamp
              </span>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div className="rounded-xl bg-black/30 p-4 border border-white/10">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-5 w-5 text-[#ffad14]" />
                    <div>
                      <span className="font-bold text-white text-sm block break-all">
                        Final_Approved_Manuscript_v2.0.pdf
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Advisio Research Archive ID: ADV-2026-ENG-089
                      </span>
                    </div>
                  </div>
                  <span className="rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-2 py-0.5 border border-emerald-400/30">
                    VERIFIED
                  </span>
                </div>

                <div className="mt-3.5 pt-3 border-t border-white/10 font-mono text-[11px] text-slate-300 break-all space-y-1">
                  <div>
                    <span className="text-slate-400">SHA-256 HASH:</span>{" "}
                    <span className="text-amber-300">
                      e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">TIMESTAMP:</span>{" "}
                    <span>2026-10-26T14:32:08.192Z (UTC)</span>
                  </div>
                </div>
              </div>

              {/* Digital Signature Chain */}
              <div className="rounded-xl bg-black/20 p-4 border border-white/10 space-y-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Signed Academic Quorum (3/3)
                </span>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-200">
                    <BadgeCheck className="h-4 w-4 text-emerald-400" />
                    <span>Dean of Graduate Studies & Research</span>
                  </span>
                  <span className="font-mono text-emerald-300 text-[11px]">Digitally Signed</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-200">
                    <BadgeCheck className="h-4 w-4 text-emerald-400" />
                    <span>Oral Defense Panel Chair</span>
                  </span>
                  <span className="font-mono text-emerald-300 text-[11px]">Digitally Signed</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-200">
                    <BadgeCheck className="h-4 w-4 text-emerald-400" />
                    <span>Lead Faculty Adviser</span>
                  </span>
                  <span className="font-mono text-emerald-300 text-[11px]">Digitally Signed</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Ready for university repository ingestion and CHED/accreditation reporting.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
