export const NURSING_UPDATE = "NURSING_INTERVIEW_WORKFLOW_V2";
export const NURSING_METHOD =
  "Quantitative, qualitative, or both, based on the supplied College of Nursing and Pharmacy interview. Nursing groups have exactly four members. All demo documents and results are fictional.";

export const NURSING_STAGES = [
  {
    name: "Adviser selection and acceptance",
    legacy: 1,
    type: "ADVISER_SELECTION",
    topic: 0,
  },
  {
    name: "Research title proposal",
    legacy: 2,
    type: "TITLE_PROPOSAL",
    topic: 0,
  },
  {
    name: "Mock proposal",
    topic: 1,
    instructions:
      "Submit a draft nursing research proposal and presentation for mock-proposal feedback.",
  },
  {
    name: "Proposal",
    legacy: 3,
    topic: 1,
    instructions:
      "Submit the revised nursing research proposal, methodology, and presentation for proposal evaluation.",
  },
  {
    name: "Data gathering",
    legacy: 7,
    topic: 2,
    instructions:
      "Submit data-gathering instruments, required supporting clearances, progress evidence, and the analysis/manuscript. Use simulated data only in this demo.",
  },
  {
    name: "Final defense eligibility and manuscript approval",
    legacy: 8,
    type: "DEFENSE_ELIGIBILITY",
    topic: 3,
    instructions:
      "Submit the completed manuscript and defense presentation. Obtain adviser/manuscript approval, coordinator eligibility, and the signed Dean approval letter through the normal defense process.",
  },
  {
    name: "Defense result and required corrections",
    legacy: 9,
    topic: 3,
    instructions:
      "Complete the scheduled defense, panel evaluation, result release, and manuscript corrections through the normal defense tools. Submit the corrections evidence here.",
  },
  {
    name: "Project execution / research colloquium",
    topic: 4,
    instructions:
      "Submit the project outputs, colloquium presentation, and execution report. Grouping research colloquium with project execution is a provisional interpretation of the handwritten interview.",
  },
  {
    name: "Research implementation",
    topic: 4,
    instructions:
      "Submit the implementation report, evidence, outcomes, limitations, and completion review.",
  },
  {
    name: "Final manuscript approval and archive submission",
    legacy: 10,
    topic: 5,
    role: "DEAN",
    instructions:
      "Submit the corrected final manuscript for final approval and the normal archive submission process. Submit a separate scanned receipt to record physical hard-copy delivery.",
  },
];

export function nursingGuideParagraphs() {
  return [
    NURSING_METHOD,
    "Interview sequence: mock proposal -> proposal -> data gathering -> defense -> project execution / research colloquium -> research implementation. Adviser/title setup and final archive submission support the system workflow.",
    ...NURSING_STAGES.map(
      (stage, i) =>
        `${i + 1}. ${stage.name}. ${stage.instructions || "Complete the normal adviser/title approval workflow."}`,
    ),
    "Accepted files: Word (DOC/DOCX), PDF, and PowerPoint (PPT/PPTX). A hard copy is a physical submission, not an uploaded file; use the separate optional hard-copy receipt requirement to record delivery.",
    "Guides: use references, sample materials, and the official research manual supplied by the college. This checklist is a demo guide, not an official UA manual or approval.",
    "Four separate demo rubric templates cover proposal, final defense, project execution, and research implementation. Their example scoring criteria and weights are illustrative; replace them with the college's approved rubrics before official assessment.",
    "Legacy proposal-defense history and stored submissions remain intact. New requirements have no invented approvals. The advanced group must complete the newly introduced mock proposal before continuing the revised sequence.",
    "Defense scheduling still requires manuscript approval, coordinator eligibility, the signed Dean letter, panel invitations, packet publication, evaluation, and official result release.",
  ];
}

export async function updateNursingWorkflow({
  db,
  dataset,
  datasetId,
  lock,
  assertOwnedRoots,
  roots,
  progress,
  form,
  program,
}) {
  return db.$transaction(
    async (tx) => {
      await lock(tx);
      const data = await roots(tx);
      assertOwnedRoots(data);
      const workflow = data.workflows.find((w) => w.name === `${dataset} BSN`);
      const manifest = await tx.auditLog.findFirst({
        where: { entityId: datasetId, eventType: "PROGRAM_DEMO_CREATED" },
        orderBy: { createdAt: "desc" },
      });
      if (!workflow || !manifest?.newValues?.workflows?.includes(workflow.id))
        throw new Error(
          "The Nursing workflow must belong to the immutable demo manifest.",
        );
      const previousUpdate = await tx.auditLog.findFirst({
        where: { entityId: workflow.id, eventType: NURSING_UPDATE },
      });
      if (previousUpdate)
        return { workflowId: workflow.id, alreadyUpdated: true };
      if (workflow.version !== 1)
        throw new Error(
          "The Nursing demo changed version; inspect it before updating.",
        );
      const stages = await tx.workflowStage.findMany({
        where: { workflowId: workflow.id },
        orderBy: { sequence: "asc" },
        include: { tasks: true },
      });
      const expected = [
        "Adviser selection and acceptance",
        "Research title proposal",
        "Research proposal, initial chapters, and methodology",
        "Proposal defense eligibility and manuscript approval",
        "Proposal defense result and approved corrections",
        "Research ethics application and instrument validation",
        "Fictional data collection, analysis, and nursing manuscript completion",
        "Final defense eligibility and manuscript approval",
        "Final defense result and required revisions",
        "Final manuscript approval and archive submission",
      ];
      if (
        stages.length !== 10 ||
        stages.some(
          (s, i) =>
            s.name !== expected[i] ||
            s.category === "Archived" ||
            s.sequence !== i + 1,
        )
      )
        throw new Error(
          "Nursing milestones differ from the original demo. Inspect changes before migration.",
        );
      const projects = data.projects.filter(
        (p) => p.workflowInstance?.workflowId === workflow.id,
      );
      if (
        projects.length !== 2 ||
        projects.some(
          (p) =>
            p.members.filter((m) =>
              ["LEADER", "MEMBER"].includes(m.projectRole),
            ).length !== 4,
        )
      )
        throw new Error(
          "The two Nursing demo groups must each have four students.",
        );
      const oldValues = {
        version: workflow.version,
        description: workflow.description,
        stages: stages.map(({ tasks, ...stage }) => stage),
        tasks: stages.flatMap((s) => s.tasks),
        instances: projects.map((p) => p.workflowInstance),
      };
      const role = await tx.role.findUniqueOrThrow({
        where: { name: "RESEARCH_COORDINATOR" },
      });
      const deanRole = await tx.role.findUniqueOrThrow({
        where: { name: "DEAN" },
      });
      const topics = await tx.workflowTopic.findMany({
        where: { workflowId: workflow.id },
        orderBy: { sequence: "asc" },
      });
      const topicTitles = [
        "Getting started",
        "Mock proposal and proposal",
        "Data gathering",
        "Defense",
        "Project execution and implementation",
        "Final submission",
      ];
      const newTopics = [];
      for (const [i, title] of topicTitles.entries())
        newTopics.push(
          topics[i]
            ? await tx.workflowTopic.update({
                where: { id: topics[i].id },
                data: { title },
              })
            : await tx.workflowTopic.create({
                data: { workflowId: workflow.id, title, sequence: i + 1 },
              }),
        );
      for (const stage of stages)
        await tx.workflowStage.update({
          where: { id: stage.id },
          data: { sequence: stage.sequence + 1000 },
        });
      let prior = null;
      const active = [];
      for (const [i, definition] of NURSING_STAGES.entries()) {
        const values = {
          name: definition.name,
          sequence: i + 1,
          topicId: newTopics[definition.topic].id,
          category: "Milestone",
          milestoneType: definition.type || "STANDARD",
          requiresApproval: true,
          requiresDocument:
            !definition.type || definition.type === "DEFENSE_ELIGIBILITY",
          responsibleRoleId:
            definition.role === "DEAN"
              ? deanRole.id
              : definition.type && definition.type !== "DEFENSE_ELIGIBILITY"
                ? stages[definition.legacy - 1].responsibleRoleId
                : role.id,
          requiredMilestoneId: prior,
          submissionMode: "TASK",
          isFinal: i === NURSING_STAGES.length - 1,
          description: `${NURSING_METHOD} ${definition.instructions || "Complete the normal adviser/title setup."}`,
        };
        const stage = definition.legacy
          ? await tx.workflowStage.update({
              where: { id: stages[definition.legacy - 1].id },
              data: values,
            })
          : await tx.workflowStage.create({
              data: { ...values, workflowId: workflow.id },
            });
        if (values.requiresDocument) {
          const oldTask =
            definition.legacy &&
            stages[definition.legacy - 1].tasks.find((t) => t.sequence === 1);
          const task = {
            title: definition.name,
            instructions: `${definition.instructions} ${NURSING_METHOD} Accepted files: Word, PDF, or PowerPoint. Example rubric weights are demo-only.`,
            isRequired: true,
            allowedFileTypes: "PDF,DOC,DOCX,PPT,PPTX",
          };
          if (oldTask)
            await tx.workflowTask.update({
              where: { id: oldTask.id },
              data: task,
            });
          else
            await tx.workflowTask.create({
              data: { ...task, stageId: stage.id, sequence: 1 },
            });
          if (i === NURSING_STAGES.length - 1)
            await tx.workflowTask.create({
              data: {
                stageId: stage.id,
                sequence: 2,
                title: "Hard-copy submission receipt",
                instructions:
                  "Optional separate record of physical hard-copy delivery. Upload a scanned receipt or faculty acknowledgment; this does not replace the manuscript or approve the archive.",
                isRequired: false,
                allowedFileTypes: "PDF,DOCX",
              },
            });
        }
        active.push(stage);
        prior = stage.id;
      }
      for (const [i, stage] of stages
        .filter((s) => !active.some((a) => a.id === s.id))
        .entries())
        await tx.workflowStage.update({
          where: { id: stage.id },
          data: {
            category: "Archived",
            sequence: active.length + i + 1,
            isFinal: false,
          },
        });
      await tx.workflow.update({
        where: { id: workflow.id },
        data: {
          version: 2,
          description: `${NURSING_METHOD} Interview sequence: mock proposal, proposal, data gathering, defense, project execution / research colloquium (provisional grouping), research implementation. Previous structure is retained in the migration audit; legacy defense milestones are archived.`,
        },
      });
      await tx.researchType.update({
        where: { id: workflow.researchTypeId },
        data: { description: NURSING_METHOD },
      });
      for (const project of projects) {
        const milestones = await progress(tx, project.id);
        const next = milestones.find((m) => !m.completed);
        await tx.workflowInstance.update({
          where: { id: project.workflowInstance.id },
          data: { workflowVersion: 2, currentStageId: next?.id || null },
        });
      }
      for (const label of [
        "Proposal",
        "Final defense",
        "Project execution",
        "Research implementation",
      ]) {
        const spec = form(
          { code: "BSN", label: `Nursing ${label}` },
          program.college.name,
          false,
        );
        spec.name = `Nursing ${label} rubric - Interview demo V2`;
        spec.feedbackPrompt =
          "Illustrative demo criteria and weights only. Replace with the college-approved rubric before official grading.";
        await tx.structuredEvaluationTemplate.create({
          data: {
            collegeId: program.collegeId,
            createdBy: workflow.createdBy,
            spec,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: null,
          action: "UPDATE",
          entityType: "Workflow",
          entityId: workflow.id,
          eventType: NURSING_UPDATE,
          oldValues,
          newValues: {
            dataset,
            version: 2,
            activeStageIds: active.map((s) => s.id),
            archivedStageIds: stages
              .filter((s) => !active.some((a) => a.id === s.id))
              .map((s) => s.id),
            source: "User-supplied Nursing research process interview",
            newRequirementsApproved: false,
          },
        },
      });
      return {
        workflowId: workflow.id,
        version: 2,
        activeStages: active.map((s) => s.name),
        archivedStages: 3,
      };
    },
    { isolationLevel: "Serializable", timeout: 60000 },
  );
}
