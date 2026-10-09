type WorkflowOption = {
  id: string;
  name: string;
};

type ResearchProjectsOnboardingProps = {
  workflows: WorkflowOption[];
  selectedWorkflowId: string;
  participantCount: number;
  onSelectWorkflow: (workflowId: string) => void;
  onCreateWorkflow: () => void;
  onOpenParticipants: () => void;
};

export function ResearchProjectsOnboarding({
  workflows,
  selectedWorkflowId,
  participantCount,
  onSelectWorkflow,
  onCreateWorkflow,
  onOpenParticipants,
}: ResearchProjectsOnboardingProps) {
  const hasWorkflow = workflows.length > 0;
  const hasParticipants = participantCount > 0;
  const currentStep = !hasWorkflow ? 0 : !hasParticipants ? 1 : 2;
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) || workflows[0];
  const steps = [
    { label: "Create workflow", detail: "Set the milestones and requirements." },
    { label: "Add participants", detail: "Invite researchers into this workflow." },
    { label: "Register projects", detail: "Research leaders register from their dashboard." },
  ];

  const content = !hasWorkflow
    ? {
        eyebrow: "Step 1 of 3",
        icon: "ti-route",
        title: "Start with a research workflow",
        description: "A workflow gives researchers the milestones, guides, and requirements they will follow before their projects appear here.",
        action: "Create workflow",
        onAction: onCreateWorkflow,
      }
    : !hasParticipants
      ? {
          eyebrow: "Step 2 of 3",
          icon: "ti-user-plus",
          title: `Add researchers to ${selectedWorkflow?.name || "this workflow"}`,
          description: "No researchers have joined this workflow yet. Open Participants to create an invitation and share it with the correct class or section.",
          action: "Add workflow participants",
          onAction: onOpenParticipants,
        }
      : {
          eyebrow: "Step 3 of 3",
          icon: "ti-folder-plus",
          title: "Researchers are ready to register projects",
          description: `${participantCount} researcher${participantCount === 1 ? " is" : "s are"} enrolled in ${selectedWorkflow?.name || "this workflow"}. A research leader registers the project from the Researcher Dashboard, and it will appear here automatically.`,
          action: "Review workflow participants",
          onAction: onOpenParticipants,
        };

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-slate-50">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
        <div>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-800">
            Beginner setup guide · {content.eyebrow}
          </span>
          <span className="mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#173f63] text-white shadow-sm">
            <i className={`ti ${content.icon} text-2xl`} />
          </span>
          <h3 className="mt-4 text-xl font-black text-[#102f49]">{content.title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{content.description}</p>

          {hasWorkflow && workflows.length > 1 && (
            <label className="mt-5 block max-w-md text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Continue setup for
              <select
                value={selectedWorkflow?.id || ""}
                onChange={(event) => onSelectWorkflow(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold normal-case tracking-normal text-[#102f49]"
              >
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={content.onAction}
            className="mt-5 inline-flex items-center rounded-xl bg-[#173f63] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#102f49]"
          >
            {content.action}
            <i className="ti ti-arrow-right ml-2" />
          </button>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Project setup</p>
          <ol className="mt-4 space-y-4">
            {steps.map((step, index) => {
              const complete = index < currentStep;
              const active = index === currentStep;
              return (
                <li key={step.label} className="flex gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${complete ? "bg-emerald-100 text-emerald-700" : active ? "bg-amber-100 text-amber-800 ring-2 ring-amber-200" : "bg-slate-100 text-slate-400"}`}>
                    {complete ? <i className="ti ti-check" /> : index + 1}
                  </span>
                  <span>
                    <strong className={`block text-sm ${active ? "text-[#102f49]" : complete ? "text-emerald-800" : "text-slate-500"}`}>{step.label}</strong>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{step.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            <i className="ti ti-info-circle mr-1.5" />
            Participants are workflow enrollments. Research Projects appear after an enrolled researcher registers a study.
          </p>
        </aside>
      </div>
    </section>
  );
}
