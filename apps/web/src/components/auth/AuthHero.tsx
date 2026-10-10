const researchAreas = [
  {
    number: "01",
    title: "Research projects",
    description: "Documents, milestones, and team responsibilities.",
  },
  {
    number: "02",
    title: "Faculty review",
    description: "Adviser feedback, consultations, and approvals.",
  },
  {
    number: "03",
    title: "Defense readiness",
    description: "Schedules, panel coordination, and final requirements.",
  },
];

export function AuthHero() {
  return (
    <section className="relative hidden min-h-screen overflow-hidden border-r border-[#214b69] bg-[#0b3553] px-[clamp(2.5rem,5vw,5.5rem)] py-10 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-[30rem] w-[30rem] select-none opacity-[0.035]">
        <img src="/school-logo.png" alt="" className="h-full w-full object-contain" />
      </div>

      <header className="relative z-10 flex items-center justify-between pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white p-1.5">
            <img src="/ao-logo.png" alt="Advisio" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-[18px] font-extrabold tracking-[.06em]">ADVISIO</div>
            <div className="text-[9px] font-bold uppercase tracking-[.22em] text-[#f3b327]">Research portal</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-right">
          <div>
            <p className="text-[11px] font-semibold leading-tight">University of the Assumption</p>
            <p className="mt-0.5 text-[9px] text-slate-300">City of San Fernando, Pampanga</p>
          </div>
          <img src="/school-logo.png" alt="University of the Assumption" className="h-10 w-10 object-contain" />
        </div>
      </header>

      <div className="relative z-10 my-auto max-w-[640px] py-12">
        <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#f3b327]">University Research Management System</p>
        <h1 className="mt-5 text-[clamp(2.6rem,4.4vw,4.3rem)] font-semibold leading-[1.08] tracking-[-.035em]">
          A clearer way to manage academic research.
        </h1>
        <p className="mt-6 max-w-[570px] text-[15px] leading-7 text-slate-300">
          Advisio brings researchers, advisers, panelists, and administrators into one organized workspace from proposal to final defense.
        </p>

        <div className="mt-12 border-y border-white/15">
          {researchAreas.map((area) => (
            <div
              key={area.number}
              className="grid grid-cols-[42px_minmax(0,1fr)] gap-4 border-b border-white/10 py-4 last:border-b-0 sm:grid-cols-[42px_150px_minmax(0,1fr)] sm:items-center"
            >
              <span className="font-mono text-[11px] font-bold text-[#f3b327]">{area.number}</span>
              <p className="text-[13px] font-bold text-white">{area.title}</p>
              <p className="col-start-2 text-[12px] leading-5 text-slate-300 sm:col-start-auto">{area.description}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5 text-[10px] text-slate-400">
        <span>For authorized university users</span>
        <span>ADVISIO · 2026</span>
      </footer>
    </section>
  );
}
