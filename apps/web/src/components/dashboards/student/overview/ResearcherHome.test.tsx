import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { studentTasksHref } from "@/lib/student-task-navigation";
import { ResearcherHomeHero } from "./ResearcherHome";

it("scopes a one-step workflow's 100% progress to its published requirements", () => {
  const markup = renderToStaticMarkup(
    <MemoryRouter>
      <ResearcherHomeHero
        title="BiteCheck"
        steps={[{ id: "adviser", name: "Secure faculty adviser", state: "done" }]}
        progress={100}
        workflowName="Capstone Research"
        workflowHref={studentTasksHref("project-1", "workflow-1")}
        journeyMessage=""
        members={[]}
        memberCount={1}
        action={<button>Open research workspace</button>}
      />
    </MemoryRouter>,
  );

  expect(markup).toContain("100% of workflow requirements complete");
  expect(markup).toContain("Capstone Research");
  expect(markup).toContain("1 of 1 milestone complete");
  expect(markup).toContain("Secure faculty adviser");
  expect(markup).toContain('href="/student/tasks?projectId=project-1&amp;workflowId=workflow-1"');
});
