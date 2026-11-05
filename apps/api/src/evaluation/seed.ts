import { PrismaClient, type InstitutionalRole } from "@prisma/client";
import { seedReferenceData } from "@research-management/database";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { randomBytes, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { seedEvaluationClassRecord } from "./seed-class-record.js";
import {
  EVALUATION_ROLES,
  type EvaluationCourse,
  type EvaluationRole,
} from "./catalog.js";

const day = (n: number) => {
  const anchor = new Date();
  anchor.setUTCHours(2, 0, 0, 0);
  return new Date(+anchor + n * 86_400_000);
};
type ManuscriptCourse = Omit<EvaluationCourse, "researchers" | "title"> & {
  researchers: readonly string[];
  title: string;
};
const companionTitles: Record<
  EvaluationCourse["id"],
  readonly [string, string]
> = {
  BSIT: [
    "Campus Facility Directory and Accessibility Requirements Assessment",
    "Campus Navigation Interface Usability Evaluation Plan",
  ],
  BEED: [
    "Timeliness of Classroom Feedback and Student Participation in General Education Classes",
    "Feedback Clarity and Self Regulated Learning among First Year Students",
  ],
  BSN: [
    "Clinical Instructor Support and Learning Confidence among Nursing Students",
    "Clinical Learning Opportunities and Student Coping Practices",
  ],
  BSA: [
    "Spreadsheet Bookkeeping Practices among Neighborhood Retailers",
    "Record Organization and Reconciliation Practices among Small Retail Enterprises",
  ],
  BSTM: [
    "Visitor Wayfinding and Information Services at Community Heritage Sites",
    "Service Responsiveness and Visitor Experience at Local Heritage Attractions",
  ],
  BSCE: [
    "Roadside Inlet Condition Assessment for a Residential Drainage Improvement Concept",
    "Preliminary Outfall and Surface Runoff Assessment for a Neighborhood Street",
  ],
  BSARCH: [
    "A Shaded Neighborhood Reading Pavilion for Community Learning",
    "An Adaptable Community Study Center with Passive Cooling Strategies",
  ],
};
export async function manuscript(course: ManuscriptCourse, version: number) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sections = [
    [
      "Research proposal",
      course.title,
      `Research type: ${course.type}`,
      `Researchers: ${course.researchers.join(", ")}`,
      `Adviser: ${course.adviser}`,
      "Purpose",
      course.objective,
      "Scope",
      ...course.details,
    ],
    [
      "Proposed method and review record",
      course.method,
      "Review note",
      course.feedback,
      "Revision response",
      version === 3
        ? course.revision
        : "The review points remain open for the next manuscript revision.",
      "Planned outputs",
      ...course.details.map((text, i) => `${i + 1}. ${text}`),
    ],
    [
      "Research preparation checklist",
      "Confirm the research questions, eligibility criteria or design inputs, and adviser recommendations.",
      course.revision,
      "Document review history",
      "Version 1: Initial scope and method submitted.",
      "Version 2: Scope clarified; adviser requests further detail.",
      ...(version === 3
        ? ["Version 3: Prepared revision addresses the recorded review points."]
        : []),
      "Evaluation disclosure",
      "These fictional research records were prepared for the ADVISIO evaluation. No actual participants, empirical findings, patient records, financial accounts, or verified engineering design values are represented.",
    ],
  ];
  for (const lines of sections) {
    const page = pdf.addPage([595, 842]);
    let y = 790;
    page.drawText(`${course.label} | Manuscript v${version}`, {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.35, 0.4),
    });
    y -= 34;
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      const size = i === 0 ? 17 : 11;
      const face = i === 0 ? bold : font;
      const words = text.split(/\s+/);
      let row = "";
      for (const word of words) {
        if (face.widthOfTextAtSize(`${row} ${word}`, size) > 495 && row) {
          page.drawText(row, { x: 48, y, size, font: face });
          y -= 17;
          row = word;
        } else row += `${row ? " " : ""}${word}`;
      }
      if (row) page.drawText(row, { x: 48, y, size, font: face });
      y -= 30;
    }
    page.drawText("ADVISIO | Evaluation environment", {
      x: 48,
      y: 30,
      size: 9,
      font,
    });
  }
  return Buffer.from(await pdf.save());
}

export async function seedWorkspace(
  db: PrismaClient,
  course: EvaluationCourse,
  selectedRole: EvaluationRole,
  storageRoot: string,
) {
  await seedReferenceData(db);
  await fs.mkdir(storageRoot, { recursive: true });
  const college = await db.college.findUniqueOrThrow({
    where: { code: course.collegeCode },
  });
  const program = await db.program.findFirstOrThrow({
    where: { code: course.id, collegeId: college.id },
  });
  const year = await db.academicYear.create({
    data: {
      name: "2026-2027",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
    },
  });
  const users: Record<string, string> = {};
  const names = {
    student: course.researchers[0],
    adviser: course.adviser,
    professor: "Paolo Villanueva",
    panelist: "Marisol Cruz",
    dean: "Aurelia Mendoza",
  };
  for (const definition of EVALUATION_ROLES) {
    const [firstName, ...rest] = names[definition.id].split(" ");
    const role = await db.role.findUniqueOrThrow({
      where: { name: definition.institutionalRole },
    });
    const user = await db.user.create({
      data: {
        universityId: `AY26-${definition.id.toUpperCase()}`,
        email: `${definition.id}@evaluation.invalid`,
        firstName,
        lastName: rest.join(" "),
        passwordHash: randomBytes(48).toString("hex"),
        status: "ACTIVE",
        collegeId: college.id,
        programId: program.id,
        roles: { create: { roleId: role.id } },
        collegeMemberships: {
          create: {
            collegeId: college.id,
            roleNames: [definition.institutionalRole],
          },
        },
      },
    });
    users[definition.id] = user.id;
    if (definition.id !== "student")
      await db.facultyProfile.create({
        data: {
          userId: user.id,
          academicTitle: "Faculty Member",
          facultyDesignation: definition.label,
          department: college.name,
          expertiseKeywords: [course.type],
          researchInterests: [course.label],
        },
      });
    else
      await db.researcherProfile.create({
        data: {
          userId: user.id,
          academicYearId: year.id,
          degreeLevel: "UNDERGRADUATE",
          yearLevel: "YEAR_4",
          academicTerm: "FIRST_SEMESTER",
          researchStatus: "HAS_PROJECT",
          groupSetup: course.researchers.length > 1 ? "GROUP" : "INDIVIDUAL",
          researchType: course.researchers.length > 1 ? "GROUP" : "INDIVIDUAL",
          interests: [course.label],
          status: "SUBMITTED",
          submittedAt: day(-30),
        },
      });
  }
  const roster = [users.student];
  for (const [i, name] of course.researchers.slice(1).entries()) {
    const [firstName, ...last] = name.split(" ");
    const role = await db.role.findUniqueOrThrow({
      where: { name: "RESEARCHER" },
    });
    const u = await db.user.create({
      data: {
        universityId: `AY26-R0${i + 2}`,
        email: `researcher${i + 2}@evaluation.invalid`,
        firstName,
        lastName: last.join(" "),
        passwordHash: randomBytes(48).toString("hex"),
        status: "ACTIVE",
        collegeId: college.id,
        programId: program.id,
        roles: { create: { roleId: role.id } },
        collegeMemberships: {
          create: { collegeId: college.id, roleNames: ["RESEARCHER"] },
        },
      },
    });
    roster.push(u.id);
  }
  const researchType = await db.researchType.create({
    data: { programId: program.id, code: "AY26-PROPOSAL", name: course.type },
  });
  const workflow = await db.workflow.create({
    data: {
      researchTypeId: researchType.id,
      name: `${course.label} Research Preparation`,
      description: course.method,
      status: "PUBLISHED",
      version: 1,
      createdBy: users.professor,
      publishedAt: day(-30),
    },
  });
  await db.researchType.update({
    where: { id: researchType.id },
    data: { workflowId: workflow.id },
  });
  await db.workflowEnrollment.createMany({
    data: roster.map((userId) => ({ workflowId: workflow.id, userId })),
  });
  const stages: { id: string }[] = [];
  const tasks: { id: string }[] = [];
  const stageTitles = [
    "Topic and scope preparation",
    course.stage,
    "Proposal defense",
    "Research preparation clearance",
  ];
  for (const [i, title] of stageTitles.entries()) {
    const responsible: InstitutionalRole =
      i === 2 ? "PANELIST" : i === 3 ? "DEAN" : "RESEARCHER";
    const role = await db.role.findUniqueOrThrow({
      where: { name: responsible },
    });
    const stage = await db.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name: title,
        sequence: i + 1,
        responsibleRoleId: role.id,
        requiresDocument: true,
        requiresApproval: true,
        submissionMode: "TASK",
        isFinal: i === 3,
        deadlineDays: 3,
        targetCompletionDate: day(i === 0 ? -7 : 3 + i),
      },
    });
    stages.push(stage);
    tasks.push(
      await db.workflowTask.create({
        data: {
          stageId: stage.id,
          title: i === 1 ? "Revised research proposal" : title,
          instructions: i === 1 ? course.revision : course.objective,
          sequence: 1,
          dueDays: 3,
          allowedFileTypes: "PDF",
          isRequired: true,
        },
      }),
    );
  }
  const projectCount =
    selectedRole === "professor" || selectedRole === "dean" ? 3 : 1;
  let primaryProject = "";
  let primaryDefense = "";
  for (let n = 0; n < projectCount; n++) {
    const researcherNames =
      n === 0
        ? course.researchers
        : (n === 1
            ? ["Elise Pangan", "Noel Santiago", "Trisha Mendoza"]
            : ["Rafael Bautista", "Angela Dizon", "Luis Ramos"]
          ).slice(0, course.researchers.length);
    const projectRoster = n === 0 ? [...roster] : ([] as string[]);
    if (n > 0) {
      const role = await db.role.findUniqueOrThrow({
        where: { name: "RESEARCHER" },
      });
      for (const [index, name] of researcherNames.entries()) {
        const [firstName, ...last] = name.split(" ");
        const person = await db.user.create({
          data: {
            universityId: `AY26-G${n + 1}-R${index + 1}`,
            email: `group${n + 1}.researcher${index + 1}@evaluation.invalid`,
            firstName,
            lastName: last.join(" "),
            passwordHash: randomBytes(48).toString("hex"),
            status: "ACTIVE",
            collegeId: college.id,
            programId: program.id,
            roles: { create: { roleId: role.id } },
            collegeMemberships: {
              create: { collegeId: college.id, roleNames: ["RESEARCHER"] },
            },
          },
        });
        projectRoster.push(person.id);
      }
      await db.workflowEnrollment.createMany({
        data: projectRoster.map((userId) => ({
          workflowId: workflow.id,
          userId,
        })),
      });
    }
    const projectOwner = projectRoster[0];
    const projectCourse: ManuscriptCourse = {
      ...course,
      researchers: researcherNames,
      title: n === 0 ? course.title : companionTitles[course.id][n - 1],
    };
    const panel = selectedRole === "panelist";
    const reviewReady =
      selectedRole === "adviser" ||
      selectedRole === "dean" ||
      selectedRole === "professor";
    const currentStage = panel ? 2 : n === 2 ? 0 : 1;
    const manuscriptStage = n === 2 ? 0 : 1;
    const lifecycle = panel
      ? "APPROVED"
      : reviewReady
        ? "IN_REVIEW"
        : "REVISION_REQUIRED";
    const project = await db.researchProject.create({
      data: {
        researchTypeId: researchType.id,
        programId: program.id,
        collegeId: college.id,
        academicYearId: year.id,
        title: projectCourse.title,
        groupName:
          n === 0
            ? "Research Group A"
            : `Research Group ${String.fromCharCode(65 + n)}`,
        participationMode: course.researchers.length > 1 ? "GROUP" : "SOLO",
        accessMode: "INVITE_ONLY",
        abstract: course.objective,
        status: panel
          ? "DEFENSE"
          : n === 2
            ? "DRAFT"
            : reviewReady
              ? "UNDER_REVIEW"
              : "REVISION",
        createdBy: projectOwner,
      },
    });
    if (!n) primaryProject = project.id;
    const instance = await db.workflowInstance.create({
      data: {
        researchId: project.id,
        workflowId: workflow.id,
        workflowVersion: 1,
        currentStageId: stages[currentStage].id,
        startedAt: day(-14),
      },
    });
    await db.researchProject.update({
      where: { id: project.id },
      data: { workflowInstanceId: instance.id },
    });
    await db.researchMember.createMany({
      data: [
        ...projectRoster.map((userId, i) => ({
          researchId: project.id,
          userId,
          projectRole: (i === 0 ? "LEADER" : "MEMBER") as "LEADER" | "MEMBER",
        })),
        {
          researchId: project.id,
          userId: users.adviser,
          projectRole: "ADVISER",
        },
        {
          researchId: project.id,
          userId: users.professor,
          projectRole: "COORDINATOR",
        },
        {
          researchId: project.id,
          userId: users.panelist,
          projectRole: "PANELIST",
        },
      ],
    });
    await db.workflowTransition.create({
      data: {
        workflowInstanceId: instance.id,
        fromStageId: stages[0].id,
        toStageId: stages[currentStage].id,
        performedBy: users.professor,
        remarks: "Scope reviewed; project ready for the next milestone.",
        createdAt: day(-7),
      },
    });
    await db.adviserRequest.create({
      data: {
        researchId: project.id,
        adviserId: users.adviser,
        requestedById: projectOwner,
        status: "ACCEPTED",
        note: "Please review the proposed scope and method.",
        respondedAt: day(-14),
      },
    });
    const document = await db.document.create({
      data: {
        researchId: project.id,
        milestoneId: stages[manuscriptStage].id,
        documentType: `TASK_${tasks[manuscriptStage].id}`,
        title: "Research proposal",
        currentVersion: 2,
        storageProvider: "LOCAL",
        lifecycleStatus: lifecycle,
        createdBy: projectOwner,
      },
    });
    const versions = [];
    for (const version of [1, 2]) {
      const buffer = await manuscript(projectCourse, version);
      const fileName = `${course.short}_Proposal_v${version}.pdf`;
      const file = path.join(storageRoot, `${project.id}-${fileName}`);
      await fs.writeFile(file, buffer, { flag: "wx" });
      versions.push(
        await db.documentVersion.create({
          data: {
            documentId: document.id,
            versionNumber: version,
            fileName,
            mimeType: "application/pdf",
            fileSize: BigInt(buffer.length),
            storagePath: file,
            uploadedBy: projectOwner,
            status: version === 2 ? "ACTIVE" : "SUPERSEDED",
            manuscriptStatus: version === 2 ? lifecycle : "REVISION_REQUIRED",
            isImmutable: true,
            contentChecksum: createHash("sha256").update(buffer).digest("hex"),
            submittedBy: projectOwner,
            submittedAt: day(version === 1 ? -7 : -1),
            milestoneId: stages[manuscriptStage].id,
          },
        }),
      );
    }
    const latest = versions[1];
    const submissionStatus = panel
      ? "APPROVED"
      : reviewReady
        ? "SUBMITTED"
        : "REVISION_REQUIRED";
    if (currentStage > 0) {
      const scope = await db.document.create({
        data: {
          researchId: project.id,
          milestoneId: stages[0].id,
          documentType: `TASK_${tasks[0].id}`,
          title: "Research scope and initial proposal",
          currentVersion: 1,
          storageProvider: "LOCAL",
          lifecycleStatus: "APPROVED",
          createdBy: projectOwner,
        },
      });
      const scopeBuffer = await manuscript(projectCourse, 1);
      const scopePath = path.join(
        storageRoot,
        `${project.id}-Scope_Proposal_v1.pdf`,
      );
      await fs.writeFile(scopePath, scopeBuffer, { flag: "wx" });
      const scopeVersion = await db.documentVersion.create({
        data: {
          documentId: scope.id,
          versionNumber: 1,
          fileName: "Scope_Proposal_v1.pdf",
          mimeType: "application/pdf",
          fileSize: BigInt(scopeBuffer.length),
          storagePath: scopePath,
          uploadedBy: projectOwner,
          status: "ACTIVE",
          manuscriptStatus: "APPROVED",
          isImmutable: true,
          contentChecksum: createHash("sha256")
            .update(scopeBuffer)
            .digest("hex"),
          submittedBy: projectOwner,
          submittedAt: day(-7),
          milestoneId: stages[0].id,
        },
      });
      await db.taskSubmission.create({
        data: {
          researchId: project.id,
          taskId: tasks[0].id,
          documentId: scope.id,
          documentVersionId: scopeVersion.id,
          submittedBy: projectOwner,
          status: "APPROVED",
          submittedAt: day(-7),
          reviewedAt: day(-6),
          reviewNote: "The scope is appropriate for proposal preparation.",
        },
      });
    }
    const submission = await db.taskSubmission.create({
      data: {
        researchId: project.id,
        taskId: tasks[manuscriptStage].id,
        documentId: document.id,
        documentVersionId: latest.id,
        submittedBy: projectOwner,
        status: submissionStatus,
        note: "The current proposal is ready for review.",
        reviewNote: course.feedback,
        submittedAt: day(-1),
      },
    });
    await db.taskSubmissionAttempt.createMany({
      data: versions.map((v, i) => ({
        taskSubmissionId: submission.id,
        researchId: project.id,
        taskId: tasks[manuscriptStage].id,
        milestoneId: stages[manuscriptStage].id,
        documentId: document.id,
        documentVersionId: v.id,
        attemptNumber: i + 1,
        submittedBy: projectOwner,
        status: i === 0 ? "REVISION_REQUIRED" : submissionStatus,
        reviewNote: course.feedback,
        submittedAt: day(i === 0 ? -7 : -1),
      })),
    });
    const previous = await db.review.create({
      data: {
        documentVersionId: versions[0].id,
        documentId: document.id,
        reviewerId: users.adviser,
        reviewType: "ADVISER",
        overallComment: course.feedback,
        recommendation: "MINOR_REVISION",
        status: "SUBMITTED",
        submittedAt: day(-2),
      },
    });
    for (const [i, comment] of [
      course.feedback,
      "Align the stated objectives with the proposed outputs.",
      "Keep the document headings and version labels consistent.",
    ].entries())
      await db.reviewComment.create({
        data: {
          reviewId: previous.id,
          documentVersionId: versions[0].id,
          authorId: users.adviser,
          comment,
          status: i === 2 ? "RESOLVED" : "OPEN",
          resolvedAt: i === 2 ? day(-1) : null,
          locationData: { page: i + 1 },
        },
      });
    const reviewerId =
      selectedRole === "dean"
        ? users.dean
        : selectedRole === "professor"
          ? users.professor
          : users.adviser;
    const assignment = await db.reviewerAssignment.create({
      data: {
        researchId: project.id,
        documentId: document.id,
        documentVersionId: latest.id,
        reviewerId,
        reviewType:
          selectedRole === "dean"
            ? "DEAN"
            : selectedRole === "professor"
              ? "COORDINATOR"
              : "ADVISER",
        assignedById: users.professor,
        status: panel ? "COMPLETED" : "ACTIVE",
        completedAt: panel ? day(-1) : null,
      },
    });
    await db.reviewerAssignmentEvent.create({
      data: {
        assignmentId: assignment.id,
        action: "ASSIGNED",
        actorId: users.professor,
      },
    });
    await db.manuscriptStatusEvent.create({
      data: {
        documentId: document.id,
        versionId: latest.id,
        fromStatus: "SUBMITTED",
        toStatus: lifecycle,
        actorId: users.adviser,
        reason: panel ? "Approved for proposal defense." : course.feedback,
      },
    });
    const consultation = await db.consultation.create({
      data: {
        researchId: project.id,
        createdBy: projectOwner,
        title: "Proposal revision consultation",
        description: course.feedback,
        scheduledStart: day(2),
        scheduledEnd: day(2 + 1 / 24),
        status: selectedRole === "adviser" ? "REQUESTED" : "SCHEDULED",
      },
    });
    await db.consultationParticipant.createMany({
      data: [...projectRoster, users.adviser].map((userId) => ({
        consultationId: consultation.id,
        userId,
        attendanceStatus: "ACCEPTED",
      })),
    });
    const previousConsultation = await db.consultation.create({
      data: {
        researchId: project.id,
        createdBy: projectOwner,
        title: "Research scope and method discussion",
        description:
          "Review of objectives, sources, and preparation for the next proposal revision.",
        scheduledStart: day(-5),
        scheduledEnd: day(-5 + 1 / 24),
        status: "COMPLETED",
        notes: {
          create: {
            authorId: users.adviser,
            notes: `${course.feedback} The group agreed to organize the supporting literature and check the revised objectives before the next consultation.`,
            actionItems: [
              course.revision,
              "Update the literature review matrix.",
              "Bring the revised proposal to the next consultation.",
            ],
            createdAt: day(-5),
          },
        },
      },
    });
    await db.consultationParticipant.createMany({
      data: [...projectRoster, users.adviser].map((userId) => ({
        consultationId: previousConsultation.id,
        userId,
        attendanceStatus: "LEFT",
        joinedAt: day(-5),
        leftAt: day(-5 + 1 / 24),
      })),
    });
    if (panel) {
      const defense = await db.defenseSession.create({
        data: {
          researchId: project.id,
          status: "LIVE",
          queueStatus: "IN_PROGRESS",
          venue: "Research Presentation Room",
          scheduledStart: day(0),
          scheduledEnd: day(1 / 24),
          createdBy: users.professor,
          startedAt: day(-1 / 24),
          startedBy: users.professor,
        },
      });
      primaryDefense = defense.id;
      await db.defenseInvitation.create({
        data: {
          defenseSessionId: defense.id,
          inviteeId: users.panelist,
          role: "PANEL_CHAIR",
          status: "ACCEPTED",
          respondedAt: day(-1),
        },
      });
      const structuredForm = {
        name: `${course.label} Proposal Evaluation`,
        branding: {
          schoolName: "University of the Assumption",
          schoolAddress: "City of San Fernando, Pampanga",
          collegeName: course.college,
          templateName: "Proposal Evaluation (Evaluation environment)",
          schoolLogo: "",
          collegeLogo: "",
        },
        scale: [
          { value: 1, label: "Needs improvement" },
          { value: 2, label: "Developing" },
          { value: 3, label: "Proficient" },
          { value: 4, label: "Excellent" },
        ],
        presentation: [
          {
            id: "clarity",
            title: "Clarity of presentation",
            description: "Communicates the proposal clearly.",
            weight: 50,
          },
          {
            id: "response",
            title: "Response to questions",
            description: "Explains the proposed decisions.",
            weight: 50,
          },
        ],
        manuscript: [
          {
            id: "scope",
            title: "Research scope and objectives",
            description: course.objective,
            weight: 40,
          },
          {
            id: "method",
            title: "Appropriateness of proposed method",
            description: course.method,
            weight: 40,
          },
          {
            id: "organization",
            title: "Organization and consistency",
            description: "Organizes the manuscript clearly.",
            weight: 20,
          },
        ],
        feedbackLabel: "Recommendations",
        feedbackPrompt: "Record the revisions needed for this proposal.",
        signatureRequired: false,
      };
      await db.defensePacket.create({
        data: {
          defenseSessionId: defense.id,
          manuscriptVersionId: latest.id,
          publishedById: users.professor,
          publishedAt: day(-1),
          status: "PUBLISHED",
          evaluationMode: "STRUCTURED",
          structuredForm: {
            spec: structuredForm,
            roster: projectRoster.map((userId, i) => ({
              userId,
              name: projectCourse.researchers[i],
            })),
            panelists: [
              { userId: users.panelist, name: names.panelist, required: true },
            ],
            researchTitle: projectCourse.title,
            manuscriptVersionId: latest.id,
            publishedAt: day(-1).toISOString(),
          },
          evaluationSignatureRequired: false,
        },
      });
    }
  }
  await seedEvaluationClassRecord(
    db,
    workflow.id,
    users.professor,
    [day(-12), day(-10), day(-8)],
    day(-4),
  );
  const userId = users[selectedRole];
  const home = EVALUATION_ROLES.find((r) => r.id === selectedRole)!.home;
  await db.notification.createMany({
    data: [
      ["Proposal ready for review", course.stage],
      ["Revision guidance available", course.feedback],
      [
        "Consultation scheduled",
        "Your next consultation is scheduled in two days.",
      ],
      ...(selectedRole === "student"
        ? [
            [
              "Prelim grades released",
              "Your fictional prelim scores and attendance record are ready in Class Grades.",
              "/student/grades",
            ],
          ]
        : []),
      ...(selectedRole === "professor"
        ? [
            [
              "Class record ready",
              "Prelim activities, attendance, and released grades are available for your enrolled researchers.",
              "/professor/class-record",
            ],
          ]
        : []),
    ].map(([title, message, actionUrl]) => ({
      recipientId: userId,
      type: "REVIEW_ASSIGNED" as const,
      title,
      message,
      audience:
        selectedRole === "student"
          ? "researcher"
          : selectedRole === "dean"
            ? "dean"
            : selectedRole,
      actionUrl: actionUrl || home,
      entityType: "ResearchProject",
      entityId: primaryProject,
    })),
  });
  const revisionPath = path.join(
    storageRoot,
    `${course.short}_Proposal_v3.pdf`,
  );
  await fs.writeFile(revisionPath, await manuscript(course, 3), { flag: "wx" });
  return {
    userId,
    projectId: primaryProject,
    defenseId: primaryDefense,
    revisionPath,
  };
}
