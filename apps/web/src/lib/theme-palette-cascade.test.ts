import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { COLLEGE_THEMES } from "./college-themes";

const stylesheet = postcss.parse(
  readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"),
);
const properties = [
  "--color-background",
  "--sidebar-background",
  "--header-background",
  "--color-surface",
  "--color-text-primary",
  "--color-text-secondary",
];

// Evaluate the stylesheet's simple root palette selectors in CSS cascade order.
// This covers the pre-frame shell: no nested portal .dark element is present.
function rootPalette(college: string, dark: boolean, appearance: string) {
  const values = new Map<string, { specificity: number; value: string }>();
  const attributes: Record<string, string> = {
    "data-college-theme": college,
    "data-appearance": appearance,
  };
  stylesheet.walkRules((rule) => {
    const declarations = rule.nodes.filter(
      (node) => node.type === "decl" && properties.includes(node.prop),
    );
    if (!declarations.length) return;
    for (const selector of rule.selector
      .split(",")
      .map((item) => item.trim())) {
      // A descendant, body, or functional selector cannot define these root values.
      const tokens: string[] = selector.match(/:root|\.[\w-]+|\[[^\]]+\]/g) || [];
      if (tokens.join("") !== selector) continue;
      const matches = tokens.every((token) => {
        if (token === ":root") return true;
        if (token.startsWith(".")) return token === ".dark" && dark;
        const attribute = token.match(/^\[([\w-]+)(?:="([^"]+)")?\]$/);
        return (
          attribute &&
          attributes[attribute[1]] !== undefined &&
          (!attribute[2] || attributes[attribute[1]] === attribute[2])
        );
      });
      if (!matches) continue;
      for (const declaration of declarations) {
        if (declaration.type !== "decl") continue;
        const specificity = tokens.length + (declaration.important ? 1000 : 0);
        if (specificity >= (values.get(declaration.prop)?.specificity ?? -1))
          values.set(declaration.prop, {
            specificity,
            value: declaration.value,
          });
      }
    }
  });
  return properties.map((property) => values.get(property)?.value);
}

describe("loading shell theme palette", () => {
  it.each(Object.keys(COLLEGE_THEMES))(
    "uses dark root surfaces with the %s college palette before a portal mounts",
    (key) => {
      const expected = [
        "#111820",
        "#19232D",
        "#19232D",
        "#222D38",
        "#F1F5F9",
        "#A8B6C6",
      ];
      expect(rootPalette(key, true, "dark")).toEqual(expected);
      expect(rootPalette(key, true, "system")).toEqual(expected);
      expect(rootPalette(key, false, "dark")).toEqual(expected);
    },
  );
  it("keeps the college's light palette when light mode is selected", () => {
    expect(rootPalette("bsit", false, "light").slice(0, 4)).toEqual([
      "#EFF1F1",
      "#DEE2E1",
      "#DEE2E1",
      "#F6F7F7",
    ]);
  });
});
