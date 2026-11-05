import {
  PrismaClient,
  type InstitutionalRole,
  type ManuscriptLifecycleStatus,
  type ReviewType,
} from "@prisma/client";
import { seedReferenceData } from "@research-management/database";
import { randomBytes, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { seedEvaluationClassRecord } from "./seed-class-record.js";
import { manuscript, type ManuscriptCourse } from "./manuscript.js";
import {
  EVALUATION_ROLES,
  DEFAULT_MILESTONES,
  PROJECT_SCENARIOS,
  ROLE_PROJECTS,
  type EvaluationCourse,
  type EvaluationRole,
  type Scenario,
} from "./catalog.js";
import {
  scoreStructuredEvaluation,
  type FormSnapshot,
} from "../services/structured-evaluation.service.js";
export { manuscript } from "./manuscript.js";

const day = (n: number) => {
  const anchor = new Date();
  anchor.setUTCHours(2, 0, 0, 0);
  return new Date(+anchor + n * 86_400_000);
};
const hash = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");
const companionTitles: Record<
  EvaluationCourse["id"],
  readonly [string, string, string]
> = {
  BSIT: [
    "Campus Facility Directory and Accessibility Requirements Assessment",
    "Campus Navigation Interface Usability Evaluation Plan",
    "Accessible Campus Wayfinding and Information Design",
  ],
  BEED: [
    "Timeliness of Classroom Feedback and Student Participation",
    "Feedback Clarity and Self Regulated Learning among First Year Students",
    "Peer Feedback Practices and Learning Engagement",
  ],
  BSN: [
    "Clinical Instructor Support and Learning Confidence among Nursing Students",
    "Clinical Learning Opportunities and Student Coping Practices",
    "Learning Support and Perceived Stress during Clinical Preparation",
  ],
  BSA: [
    "Spreadsheet Bookkeeping Practices among Neighborhood Retailers",
    "Record Organization and Reconciliation Practices among Small Retail Enterprises",
    "Digital Record Keeping Readiness among Community Microenterprises",
  ],
  BSTM: [
    "Visitor Wayfinding and Information Services at Community Heritage Sites",
    "Service Responsiveness and Visitor Experience at Local Heritage Attractions",
    "Accessible Visitor Information and Heritage Tourism Participation",
  ],
  BSCE: [
    "Roadside Inlet Condition Assessment for a Residential Drainage Concept",
    "Preliminary Outfall and Surface Runoff Assessment for a Neighborhood Street",
    "Community Drainage Maintenance and Ponding Observation Plan",
  ],
  BSARCH: [
    "A Shaded Neighborhood Reading Pavilion for Community Learning",
    "An Adaptable Community Study Center with Passive Cooling Strategies",
    "Accessible Circulation for a Community Learning Hub",
  ],
  BSPSYCH: [
    "Study Scheduling and Learning Persistence among College Students",
    "Peer Study Support and Academic Engagement",
    "Learning Environment Preferences and Undergraduate Study Practices",
  ],
  "BSBA-MM": [
    "Social Media Channel Use among Neighborhood Microenterprises",
    "Customer Response Practices and Digital Marketing Readiness",
    "Content Planning Practices among Community Retail Enterprises",
  ],
};
export type WorkspaceAccounts = Record<
  EvaluationRole,
  {
    userId: string;
    projectId: string;
    title: string;
    defenseId: string | null;
    projectIds: string[];
  }
>;

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
  const roles = await db.role.findMany();
  async function person(
    key: string,
    name: string,
    roleName: InstitutionalRole,
  ) {
    const [firstName, ...rest] = name.split(" ");
    const user = await db.user.create({
      data: {
        universityId: `AY26-${key.toUpperCase()}`,
        email: `${key}@evaluation.invalid`,
        firstName,
        lastName: rest.join(" "),
        passwordHash: randomBytes(48).toString("hex"),
        status: "ACTIVE",
        collegeId: college.id,
        programId: program.id,
        roles: {
          create: { roleId: roles.find((r) => r.name === roleName)!.id },
        },
        collegeMemberships: {
          create: { collegeId: college.id, roleNames: [roleName] },
        },
      },
    });
    if (roleName === "RESEARCHER")
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
    else
      await db.facultyProfile.create({
        data: {
          userId: user.id,
          academicTitle: "Faculty Member",
          facultyDesignation: roleName,
          department: college.name,
          expertiseKeywords: [course.type],
          researchInterests: [course.label],
        },
      });
    return user.id;
  }
  const names = {
    student: course.researchers[0],
    adviser: course.adviser,
    professor: "Paolo Villanueva",
    panelist: "Marisol Cruz",
    dean: "Aurelia Mendoza",
  };
  const users = {} as Record<EvaluationRole, string>;
  for (const role of EVALUATION_ROLES)
    users[role.id] = await person(
      role.id,
      names[role.id],
      role.institutionalRole,
    );
  const otherAdviser = await person(
    "other-adviser",
    "Celina Navarro",
    "ADVISER",
  );
  const otherPanelist = await person(
    "historical-panelist",
    "Victor Santos",
    "PANELIST",
  );
  const researchType = await db.researchType.create({
    data: { programId: program.id, code: "AY26-PROPOSAL", name: course.type },
  });
  const workflow = await db.workflow.create({
    data: {
      researchTypeId: researchType.id,
      name: `${course.label} Research Workflow`,
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
  const stages: { id: string }[] = [];
  const tasks: Array<{ id: string } | null> = [];
  for (const [i, name] of DEFAULT_MILESTONES.entries()) {
    const special = i === 0 || i === 1;
    const responsible: InstitutionalRole =
      i === 4 || i === 9 ? "PANELIST" : "RESEARCHER";
    const stage = await db.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name,
        sequence: i + 1,
        responsibleRoleId: roles.find((r) => r.name === responsible)!.id,
        milestoneType:
          i === 0
            ? "TITLE_PROPOSAL"
            : i === 1
              ? "ADVISER_SELECTION"
              : i === 3 || i === 8
                ? "DEFENSE_ELIGIBILITY"
                : "STANDARD",
        requiredMilestoneId: stages[i - 1]?.id,
        requiresDocument: !special,
        requiresApproval: true,
        submissionMode: "TASK",
        isFinal: i === 9,
        deadlineDays: 3,
        targetCompletionDate: day(i < 2 ? -14 + i * 3 : 3 + (i - 2) * 7),
      },
    });
    stages.push(stage);
    tasks.push(
      special
        ? null
        : await db.workflowTask.create({
            data: {
              stageId: stage.id,
              title: i === 2 ? "Revised research proposal" : name,
              instructions:
                i === 2
                  ? course.revision
                  : `Submit the ${name.toLowerCase()} record for review. Fictional evaluation sample.`,
              sequence: 1,
              dueDays: 3,
              allowedFileTypes: "PDF",
              isRequired: true,
            },
          }),
    );
  }
  const projects = {} as Record<Scenario, string>;
  const projectTitles = {} as Record<Scenario, string>;
  const defenses: Partial<Record<Scenario, string>> = {};
  for (const [scenario, definition] of Object.entries(
    PROJECT_SCENARIOS,
  ) as Array<[Scenario, (typeof PROJECT_SCENARIOS)[Scenario]]>) {
    const n = scenario.charCodeAt(0) - 65;
    const researcherNames: readonly string[] =
      scenario === "B"
        ? course.researchers
        : [
            ["Elise Pangan", "Noel Santiago", "Trisha Mendoza"],
            [],
            ["Rafael Bautista", "Angela Dizon", "Luis Ramos"],
            ["Sofia Aquino", "Adrian Lopez", "Bea Mercado"],
          ][n].slice(0, course.researchers.length);
    const roster: string[] = [];
    for (const [i, name] of researcherNames.entries())
      roster.push(
        scenario === "B" && i === 0
          ? users.student
          : await person(
              `group-${scenario.toLowerCase()}-${i + 1}`,
              name,
              "RESEARCHER",
            ),
      );
    // Historical panel material is outside the active coordinator class.
    if (scenario !== "D")
      await db.workflowEnrollment.createMany({
        data: roster.map((userId) => ({ workflowId: workflow.id, userId })),
      });
    const projectCourse: ManuscriptCourse = {
      ...course,
      researchers: researcherNames,
      title:
        scenario === "B"
          ? course.title
          : companionTitles[course.id][
              scenario === "A" ? 0 : scenario === "C" ? 1 : 2
            ],
      adviser:
        scenario === "A" || scenario === "B"
          ? course.adviser
          : "Celina Navarro",
    };
    const owner = roster[0];
    const adviserId =
      scenario === "A" || scenario === "B" ? users.adviser : otherAdviser;
    const project = await db.researchProject.create({
      data: {
        researchTypeId: researchType.id,
        programId: program.id,
        collegeId: college.id,
        academicYearId: year.id,
        title: projectCourse.title,
        groupName: `Research Group ${scenario}`,
        participationMode: course.researchers.length > 1 ? "GROUP" : "SOLO",
        accessMode: "INVITE_ONLY",
        abstract: course.objective,
        status:
          scenario === "B"
            ? "REVISION"
            : scenario === "A"
              ? "UNDER_REVIEW"
              : scenario === "C"
                ? "DEFENSE"
                : "APPROVED",
        createdBy: owner,
        registeredAt: day(-28),
      },
    });
    projects[scenario] = project.id;
    projectTitles[scenario] = projectCourse.title;
    const instance = await db.workflowInstance.create({
      data: {
        researchId: project.id,
        workflowId: workflow.id,
        workflowVersion: 1,
        currentStageId: stages[definition.current - 1].id,
        startedAt: day(-28),
      },
    });
    await db.researchProject.update({
      where: { id: project.id },
      data: { workflowInstanceId: instance.id },
    });
    await db.researchMember.createMany({
      data: [
        ...roster.map((userId, i) => ({
          researchId: project.id,
          userId,
          projectRole: i === 0 ? ("LEADER" as const) : ("MEMBER" as const),
        })),
        { researchId: project.id, userId: adviserId, projectRole: "ADVISER" },
        ...(scenario !== "D"
          ? [
              {
                researchId: project.id,
                userId: users.professor,
                projectRole: "COORDINATOR" as const,
              },
            ]
          : []),
        ...(scenario === "C" || scenario === "D"
          ? [
              {
                researchId: project.id,
                userId: users.panelist,
                projectRole: "PANELIST" as const,
              },
            ]
          : []),
      ],
    });
    await db.titleProposalSubmission.create({
      data: {
        researchId: project.id,
        stageId: stages[0].id,
        titles: [projectCourse.title],
        status: "APPROVED",
        selectedIndex: 0,
        submittedBy: owner,
        reviewedBy: users.professor,
        reviewNote: "Fictional title approved for proposal preparation.",
        submittedAt: day(-27),
        reviewedAt: day(-26),
      },
    });
    await db.adviserRequest.create({
      data: {
        researchId: project.id,
        workflowStageId: stages[1].id,
        adviserId,
        requestedById: owner,
        status: "ACCEPTED",
        note: "Please review the proposed scope and method.",
        respondedAt: day(-24),
      },
    });
    for (let i = 1; i < definition.current; i++)
      await db.workflowTransition.create({
        data: {
          workflowInstanceId: instance.id,
          fromStageId: stages[i - 1].id,
          toStageId: stages[i].id,
          performedBy: users.professor,
          remarks: `${DEFAULT_MILESTONES[i - 1]} completed. Fictional evaluation history.`,
          createdAt: day(-25 + i * 3),
        },
      });
    async function document(
      stageIndex: number,
      lifecycle: ManuscriptLifecycleStatus,
      versions: number[],
      title = DEFAULT_MILESTONES[stageIndex] as string,
    ) {
      const task = tasks[stageIndex]!;
      const doc = await db.document.create({
        data: {
          researchId: project.id,
          milestoneId: stages[stageIndex].id,
          documentType: `TASK_${task.id}`,
          title,
          currentVersion: versions.length,
          storageProvider: "LOCAL",
          lifecycleStatus: lifecycle,
          createdBy: owner,
        },
      });
      const saved = [];
      for (const [index, version] of versions.entries()) {
        const buffer = await manuscript(projectCourse, version);
        const fileName = `${course.short}_${scenario}_M${stageIndex + 1}_v${version}.pdf`;
        const file = path.join(storageRoot, fileName);
        await fs.writeFile(file, buffer, { flag: "wx" });
        const last = index === versions.length - 1;
        saved.push(
          await db.documentVersion.create({
            data: {
              documentId: doc.id,
              versionNumber: index + 1,
              fileName,
              mimeType: "application/pdf",
              fileSize: BigInt(buffer.length),
              storagePath: file,
              uploadedBy: owner,
              status: last ? "ACTIVE" : "SUPERSEDED",
              manuscriptStatus: last ? lifecycle : "REVISION_REQUIRED",
              isImmutable: true,
              contentChecksum: hash(buffer),
              submittedBy: owner,
              submittedAt: day(last ? -1 : -7),
              milestoneId: stages[stageIndex].id,
            },
          }),
        );
      }
      const latest = saved[saved.length - 1];
      const status =
        lifecycle === "APPROVED"
          ? "APPROVED"
          : lifecycle === "REVISION_REQUIRED"
            ? "REVISION_REQUIRED"
            : "UNDER_REVIEW";
      const summary = await db.taskSubmission.create({
        data: {
          researchId: project.id,
          taskId: task.id,
          documentId: doc.id,
          documentVersionId: latest.id,
          submittedBy: owner,
          status,
          note: "Fictional evaluation submission.",
          reviewNote:
            lifecycle === "REVISION_REQUIRED"
              ? course.feedback
              : lifecycle === "APPROVED"
                ? "Approved for the next milestone."
                : null,
          submittedAt: day(-1),
          reviewedAt: lifecycle === "IN_REVIEW" ? null : day(-1),
        },
      });
      await db.taskSubmissionAttempt.createMany({
        data: saved.map((v, i) => ({
          taskSubmissionId: summary.id,
          researchId: project.id,
          taskId: task.id,
          milestoneId: stages[stageIndex].id,
          documentId: doc.id,
          documentVersionId: v.id,
          attemptNumber: i + 1,
          submittedBy: owner,
          status: i === saved.length - 1 ? status : "REVISION_REQUIRED",
          submittedAt: day(i === saved.length - 1 ? -1 : -7),
          reviewNote:
            i === saved.length - 1 && lifecycle === "IN_REVIEW"
              ? null
              : course.feedback,
        })),
      });
      return { doc, saved, latest };
    }
    for (let i = 2; i < definition.current - 1; i++) {
      if ((scenario === "C" || scenario === "D") && i === 3) continue;
      await document(i, "APPROVED", [2]);
    }
    const manuscriptStage = scenario === "B" ? 2 : 3;
    const current = await document(
      manuscriptStage,
      definition.lifecycle,
      [1, 2],
    );
    const review = await db.review.create({
      data: {
        documentVersionId: current.saved[0].id,
        documentId: current.doc.id,
        reviewerId: adviserId,
        reviewType: "ADVISER",
        overallComment: course.feedback,
        recommendation: "MINOR_REVISION",
        status: "SUBMITTED",
        submittedAt: day(-6),
      },
    });
    await db.reviewComment.createMany({
      data: [
        course.feedback,
        "Align the objectives with the planned outputs.",
        "Keep headings and version labels consistent.",
      ].map((comment, i) => ({
        reviewId: review.id,
        documentVersionId: current.saved[0].id,
        authorId: adviserId,
        comment,
        status: i === 2 ? "RESOLVED" : "OPEN",
        resolvedAt: i === 2 ? day(-1) : null,
        locationData: { page: i + 2 },
      })),
    });
    async function assign(
      reviewerId: string,
      reviewType: ReviewType,
      version = current.latest,
      completed = false,
    ) {
      const assignment = await db.reviewerAssignment.create({
        data: {
          researchId: project.id,
          documentId: version.documentId,
          documentVersionId: version.id,
          reviewerId,
          reviewType,
          assignedById: users.professor,
          status: completed ? "COMPLETED" : "ACTIVE",
          completedAt: completed ? day(-1) : null,
        },
      });
      await db.reviewerAssignmentEvent.create({
        data: {
          assignmentId: assignment.id,
          action: "ASSIGNED",
          actorId: users.professor,
        },
      });
    }
    if (scenario === "A") {
      await assign(users.adviser, "ADVISER");
      await assign(users.professor, "COORDINATOR");
    } else if (scenario === "B") {
      await assign(users.adviser, "ADVISER", current.latest, true);
      await db.review.create({
        data: {
          documentId: current.doc.id,
          documentVersionId: current.latest.id,
          reviewerId: adviserId,
          reviewType: "ADVISER",
          overallComment: course.feedback,
          recommendation: "MINOR_REVISION",
          status: "SUBMITTED",
          submittedAt: day(-1),
        },
      });
    }
    await db.manuscriptStatusEvent.create({
      data: {
        documentId: current.doc.id,
        versionId: current.latest.id,
        fromStatus: "SUBMITTED",
        toStatus: definition.lifecycle,
        actorId: adviserId,
        reason:
          definition.lifecycle === "APPROVED"
            ? "Approved for title defense."
            : course.feedback,
      },
    });
    if (scenario === "A" || scenario === "B") {
      for (const state of [
        "COMPLETED",
        scenario === "A" ? "REQUESTED" : "SCHEDULED",
      ] as const) {
        const completed = state === "COMPLETED";
        const start = completed ? -5 : 2;
        const consultation = await db.consultation.create({
          data: {
            researchId: project.id,
            createdBy: owner,
            title: completed
              ? "Research scope and method discussion"
              : "Proposal revision consultation",
            description: course.feedback,
            scheduledStart: day(start),
            scheduledEnd: day(start + 1 / 24),
            status: state,
            ...(completed
              ? {
                  notes: {
                    create: {
                      authorId: adviserId,
                      notes: `${course.feedback} Fictional consultation record.`,
                      actionItems: [
                        course.revision,
                        "Update the literature review matrix.",
                        "Bring the revised proposal to the next consultation.",
                      ],
                      createdAt: day(-5),
                    },
                  },
                }
              : {}),
          },
        });
        await db.consultationParticipant.createMany({
          data: [...roster, adviserId].map((userId) => ({
            consultationId: consultation.id,
            userId,
            attendanceStatus: completed ? "LEFT" : "ACCEPTED",
            joinedAt: completed ? day(-5) : null,
            leftAt: completed ? day(-5 + 1 / 24) : null,
          })),
        });
      }
    }
    if (scenario === "C" || scenario === "D") {
      const completed = scenario === "D";
      const eligibility = await db.defenseEligibility.create({
        data: {
          researchId: project.id,
          milestoneId: stages[3].id,
          approvedBy: users.professor,
          approvedAt: day(-8),
          consumedAt: completed ? day(-3) : null,
        },
      });
      const defense = await db.defenseSession.create({
        data: {
          researchId: project.id,
          eligibilityId: eligibility.id,
          status: completed ? "COMPLETED" : "SCHEDULED",
          queueStatus: completed ? "COMPLETED" : "WAITING",
          venue: `${course.collegeCode} Research Presentation Room`,
          scheduledStart: day(completed ? -3 : 1),
          scheduledEnd: day((completed ? -3 : 1) + 1 / 24),
          createdBy: users.professor,
          preparedAt: day(-1),
          ...(completed
            ? {
                startedAt: day(-3),
                startedBy: users.professor,
                endedAt: day(-3 + 1 / 24),
                releasedAt: day(-2),
                releasedBy: users.professor,
                decision: "APPROVED",
                notes:
                  "Fictional completed title defense. Panel recommendations are available in the published evaluation history.",
              }
            : {}),
        },
      });
      defenses[scenario] = defense.id;
      await db.defenseInvitation.createMany({
        data: [
          {
            defenseSessionId: defense.id,
            inviteeId: users.panelist,
            role: "PANEL_CHAIR",
            status: "ACCEPTED",
            respondedAt: day(-4),
          },
          ...(completed
            ? [
                {
                  defenseSessionId: defense.id,
                  inviteeId: otherPanelist,
                  role: "PANELIST" as const,
                  status: "ACCEPTED" as const,
                  respondedAt: day(-4),
                },
              ]
            : []),
        ],
      });
      const snapshot: FormSnapshot = {
        spec: {
          name: `${course.label} Title Defense Evaluation`,
          branding: {
            schoolName: "University of the Assumption",
            schoolAddress: "City of San Fernando, Pampanga",
            collegeName: course.college,
            templateName: "Fictional Evaluation Sample",
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
          feedbackPrompt:
            "Record the revisions needed for this fictional proposal.",
          signatureRequired: false,
        },
        roster: roster.map((userId, i) => ({
          userId,
          name: researcherNames[i],
        })),
        panelists: [
          { userId: users.panelist, name: names.panelist, required: true },
          ...(completed
            ? [
                {
                  userId: otherPanelist,
                  name: "Victor Santos",
                  required: false,
                },
              ]
            : []),
        ],
        researchTitle: projectCourse.title,
        manuscriptVersionId: current.latest.id,
        publishedAt: day(-4).toISOString(),
      };
      await db.defensePacket.create({
        data: {
          defenseSessionId: defense.id,
          manuscriptVersionId: current.latest.id,
          publishedById: users.professor,
          publishedAt: day(-4),
          status: "PUBLISHED",
          evaluationMode: "STRUCTURED",
          structuredForm: JSON.parse(JSON.stringify(snapshot)),
          evaluationSignatureRequired: false,
        },
      });
      if (completed) {
        const scored = scoreStructuredEvaluation(
          snapshot,
          {
            researchers: Object.fromEntries(
              roster.map((id) => [id, { clarity: 3, response: 3 }]),
            ),
            manuscript: { scope: 3, method: 3, organization: 4 },
            feedback: `Fictional panel feedback by Victor Santos: ${course.revision}`,
            recommendation: "APPROVED",
          },
          true,
        );
        await db.structuredEvaluation.create({
          data: {
            defenseSessionId: defense.id,
            panelistId: otherPanelist,
            answers: JSON.parse(JSON.stringify(scored.answers)),
            totals: JSON.parse(JSON.stringify(scored.totals)),
            lockedAt: day(-3),
          },
        });
        await db.panelistManuscriptReview.create({
          data: {
            defenseSessionId: defense.id,
            panelistId: users.panelist,
            privateNotes:
              "Fictional preparation history: checked scope, objectives, and methodology before the title defense. This is a past sample record, separate from your pending Project C review.",
            reviewedAt: day(-4),
          },
        });
      } else {
        const buffer = await manuscript(projectCourse, 2);
        const fileName = `${course.short}_C_Dean_Approval.pdf`;
        const storagePath = path.join(storageRoot, fileName);
        await fs.writeFile(storagePath, buffer, { flag: "wx" });
        const approval = await db.document.create({
          data: {
            researchId: project.id,
            milestoneId: stages[4].id,
            title: "Title defense preparation - Dean approval",
            documentType: "DEAN_REVIEW",
            storageProvider: "LOCAL",
            lifecycleStatus: "IN_REVIEW",
            createdBy: users.professor,
          },
        });
        const version = await db.documentVersion.create({
          data: {
            documentId: approval.id,
            versionNumber: 1,
            fileName,
            mimeType: "application/pdf",
            fileSize: BigInt(buffer.length),
            storagePath,
            uploadedBy: users.professor,
            status: "ACTIVE",
            manuscriptStatus: "IN_REVIEW",
            isImmutable: true,
            contentChecksum: hash(buffer),
            submittedBy: users.professor,
            submittedAt: day(-1),
          },
        });
        await assign(users.dean, "DEAN", version);
      }
    }
  }
  await seedEvaluationClassRecord(
    db,
    workflow.id,
    users.professor,
    [day(-12), day(-10), day(-8)],
    day(-4),
  );
  const accounts = {} as WorkspaceAccounts;
  for (const role of EVALUATION_ROLES) {
    const primary: Scenario =
      role.id === "student"
        ? "B"
        : role.id === "panelist" || role.id === "dean"
          ? "C"
          : "A";
    accounts[role.id] = {
      userId: users[role.id],
      projectId: projects[primary],
      title: projectTitles[primary],
      defenseId: defenses[primary] || null,
      projectIds: ROLE_PROJECTS[role.id].map((s) => projects[s]),
    };
    await db.notification.create({
      data: {
        recipientId: users[role.id],
        type: "REVIEW_ASSIGNED",
        title:
          role.id === "dean"
            ? "Project C awaits Dean approval"
            : "Your evaluation workspace is ready",
        message: `Fictional ${course.collegeCode} records: ${ROLE_PROJECTS[role.id].map((s) => `Project ${s}`).join(", ")}. Open evaluation controls for the six role activities.`,
        audience:
          role.id === "student"
            ? "researcher"
            : role.id === "dean"
              ? "dean"
              : role.id,
        actionUrl: role.home,
        entityType: "ResearchProject",
        entityId: projects[primary],
      },
    });
  }
  const revisionPath = path.join(
    storageRoot,
    `${course.short}_Proposal_v3.pdf`,
  );
  await fs.writeFile(revisionPath, await manuscript(course, 3), { flag: "wx" });
  return { ...accounts[selectedRole], revisionPath, accounts };
}
