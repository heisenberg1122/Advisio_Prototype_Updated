import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";
describe("coordinator cohort implementation boundaries", () => {
  it("cohort mutations stay in the cohort API, not enrollment, cases or publication", () => {
    const file = "src/lib/coordinator-cohorts.ts";
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const writes: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ["post", "put", "patch", "delete"].includes(node.expression.name.text)) writes.push(node.arguments[0].getText(source));
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(writes).toHaveLength(5);
    for (const endpoint of writes) expect(endpoint).toContain("/api/cohorts");
    expect(writes.join(" ")).not.toMatch(/enrollment|\/api\/research|publication|publish|participation|\/api\/workspaces/);
  });
  it("cohort routes use existing coordinator role protection and retain builder navigation", () => {
    const source = readFileSync("src/routes.tsx", "utf8");
    const start = source.indexOf('["/professor/cohorts", "/professor/cohorts/:id"]');
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, start + 650)).toContain('allowedRoles={["RESEARCH_COORDINATOR", "PROFESSOR", "SYSTEM_ADMIN"]}');
    expect(source.slice(start, start + 650)).not.toContain('allowedRoles={["RESEARCHER"');
    expect(readFileSync("src/components/dashboards/professor/ProfessorSidebar.tsx", "utf8")).toContain('/professor/dashboard?tab=builder');
  });
});
