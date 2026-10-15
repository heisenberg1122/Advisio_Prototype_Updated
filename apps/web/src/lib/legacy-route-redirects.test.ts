import { describe, expect, it } from "vitest";
import {
  legacyProfessorMilestonesDestination,
  legacyPortalDashboardDestination,
  legacyStudentSubmissionsDestination,
} from "./legacy-route-redirects";

describe("legacy route compatibility", () => {
  it("routes task submissions to the authoritative task workspace", () => {
    expect(
      legacyStudentSubmissionsDestination(
        "?projectId=project-1&taskId=task-1&milestoneId=stage-1",
      ),
    ).toBe(
      "/student/tasks?projectId=project-1&taskId=task-1&milestoneId=stage-1",
    );
  });

  it("routes exact manuscript links to Documents without losing context", () => {
    expect(
      legacyStudentSubmissionsDestination(
        "?projectId=project-1&documentId=document-1&versionId=version-2",
      ),
    ).toBe(
      "/student/documents?projectId=project-1&documentId=document-1&versionId=version-2",
    );
  });

  it("routes the retired milestone prototype to the real workflow builder", () => {
    expect(
      legacyProfessorMilestonesDestination(
        "?workflowId=workflow-1&projectId=project-1",
      ),
    ).toBe(
      "/professor/dashboard?workflowId=workflow-1&projectId=project-1&tab=builder",
    );
  });

  it("preserves context for retired role pages while selecting the real tab", () => {
    expect(
      legacyPortalDashboardDestination(
        "adviser",
        "consultations",
        "?projectId=project-1",
      ),
    ).toBe("/adviser/dashboard?projectId=project-1&tab=consultations");
  });
});
