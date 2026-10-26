import React from "react";
import {
  Calendar,
  Video,
  HardDrive,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export function IntegrationsSection() {
  const integrations = [
    {
      name: "Google Drive",
      category: "Document Storage & Archiving",
      description: "An authorized administrator can connect Google Drive for research document storage. Keep manuscripts and supporting research files linked to the project workspace.",
      icon: HardDrive,
      badge: "Administrator Connection",
      details: [
        "Research documents organized with their projects",
        "Manuscripts and supporting file storage",
        "Access subject to workspace and Drive permissions",
      ],
      iconBg: "bg-blue-50 text-blue-600 border-blue-200",
    },
    {
      name: "Google Calendar",
      category: "Schedule & Deadlines",
      description: "Google Calendar supports consultation and meeting scheduling when configured by your institution. Availability depends on the connected account and granted permissions.",
      icon: Calendar,
      badge: "When Configured",
      details: [
        "Calendar events for scheduled consultations",
        "Meeting details alongside research activities",
        "Scheduling through the connected Google account",
      ],
      iconBg: "bg-amber-50 text-amber-600 border-amber-200",
    },
    {
      name: "Google Meet",
      category: "Virtual Consultations",
      description: "Consultations can include Google Meet links when meeting creation is enabled for the connected Calendar account. Teams can keep consultation notes in Advisio.",
      icon: Video,
      badge: "Consultation Meetings",
      details: [
        "Join scheduled meetings from consultation details",
        "Consultation notes linked to research activity",
        "Meet availability depends on account configuration",
      ],
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    {
      name: "Google Sign-In",
      category: "Account Authentication",
      description: "Use Google to sign in when enabled. Account onboarding and institutional role permissions continue to determine workspace access.",
      icon: KeyRound,
      badge: "When Enabled",
      details: [
        "Sign in through the configured Google connection",
        "Review the requested permissions before connecting",
        "Institutional account and role requirements still apply",
      ],
      iconBg: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
  ];

  return (
    <section id="integrations" className="relative py-24 sm:py-32 bg-white overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0b3553]/15 bg-[#0b3553]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0b3553]">
            <Sparkles className="h-3.5 w-3.5 text-[#ffad14]" />
            <span>Connected Ecosystem</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0b3553] sm:text-4xl lg:text-5xl text-balance">
            Works with the tools researchers already use.
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
            Connect Google services for sign-in, document storage, and consultation scheduling when enabled. Each connection uses the permissions granted for its purpose.
          </p>
        </div>

        {/* Integration Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {integrations.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="group rounded-2xl border border-slate-200 bg-white p-7 sm:p-8 shadow-xs hover:border-[#0b3553]/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${item.iconBg} shadow-2xs`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#0b3553] group-hover:text-[#164866] transition-colors">
                          {item.name}
                        </h3>
                        <span className="text-xs font-semibold text-slate-500">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {item.badge}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>

                  <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 text-xs text-slate-700">
                    {item.details.map((detail, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100/80 flex items-center justify-between text-xs font-bold text-[#0b3553]">
                  <span>Configured by your institution</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Optional Connection
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security / Minimal Privilege Guarantee Banner */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0b3553] text-[#ffad14]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#0b3553]">
                Your Google connection, explained
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Google sign-in, Drive storage, and Calendar scheduling are separate connections. Review our privacy policy for how data and granted permissions are used.
              </p>
            </div>
          </div>
          <a
            href="/privacy-policy"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#0b3553] hover:text-[#164866] underline"
          >
            <span>Review Privacy & API Policies</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
