import React from "react";
import {
  GraduationCap,
  Users,
  Award,
  ShieldCheck,
  Building2,
  ArrowRight,
  Check,
} from "lucide-react";

export function PlatformValueStrip() {
  const roles = [
    {
      role: "Researcher",
      subtitle: "Proposal & Revisions",
      icon: GraduationCap,
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      role: "Adviser",
      subtitle: "Mentorship & Sign-offs",
      icon: Users,
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      role: "Panelist",
      subtitle: "Examination & Rubrics",
      icon: Award,
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      role: "Research Ethics / REB",
      subtitle: "Compliance & Protocol",
      icon: ShieldCheck,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      role: "Research Office",
      subtitle: "Institutional Archiving",
      icon: Building2,
      color: "bg-slate-50 text-slate-800 border-slate-200",
    },
  ];

  return (
    <section className="border-y border-slate-200/80 bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#0b3553]">
            Cross-Functional Institutional Governance
          </p>
          <h2 className="mt-1.5 text-2xl font-extrabold text-[#0b3553] tracking-tight">
            One connected research environment
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500">
            Advisio synchronizes handoffs and authorizations across every stakeholder throughout the university.
          </p>
        </div>

        {/* Horizontal Research Workflow Diagram */}
        <div className="relative">
          {/* Connecting Track Line for Desktop */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-1/2 left-10 right-10 -translate-y-1/2 h-0.5 bg-gradient-to-r from-blue-200 via-amber-200 to-emerald-200 z-0"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
            {roles.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.role}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl border border-slate-200 bg-white hover:border-[#0b3553]/40 hover:shadow-md transition-all duration-200"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-xs mb-3 group-hover:scale-105 transition-transform ${item.color}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <span className="text-sm font-extrabold text-[#0b3553]">
                    {item.role}
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5">
                    {item.subtitle}
                  </span>

                  {/* Flow Arrow indicator between items */}
                  {index < roles.length - 1 && (
                    <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-xs">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
