import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const readCss = (path: string) =>
  postcss.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("shared workspace canvas", () => {
  it.each([
    "../components/dashboards/student/overview/research-command-center.css",
    "../components/dashboards/student/my-project-workspace.css",
    "../app/student/tasks/research-tasks.css",
    "../app/student/tasks/task-details-workspace.css",
    "../app/student/researcher-workspace-surfaces.css",
    "../app/adviser/adviser-workspace-surfaces.css",
  ])(
    "keeps %s from overriding the shared canvas after lazy styles load",
    (file) => {
      const overrides: string[] = [];
      readCss(file).walkRules((rule) => {
        // These are rules targeting the shell itself, not cards inside the page.
        const targetsCanvas = rule.selector
          .split(",")
          .some((selector) =>
            /(?:^|\s|>)\.app-workspace(?::(?:has|not)\(.+\))?$/.test(
              selector.trim(),
            ),
          );
        if (targetsCanvas)
          rule.walkDecls((declaration) => {
            if (/^background(?:-color|-image)?$/.test(declaration.prop))
              overrides.push(`${rule.selector}: ${declaration}`);
          });
      });
      expect(overrides).toEqual([]);
    },
  );

  it("uses the same color token for the full Overview canvas and navigation", () => {
    const css = readCss("../components/layout/workspace-layout.css");
    let navigation = "";
    let overview = "";
    css.walkRules((rule) => {
      if (rule.selector === ".workspace-frame")
        rule.walkDecls("--sidebar-background", (declaration) => {
          navigation = declaration.value;
        });
      if (
        rule.selector.endsWith('.app-workspace[data-workspace-view="overview"]')
      )
        rule.walkDecls("background-color", (declaration) => {
          overview = declaration.value;
        });
    });
    expect(navigation).toBeTruthy();
    expect(overview).toBe(navigation);
  });
});
