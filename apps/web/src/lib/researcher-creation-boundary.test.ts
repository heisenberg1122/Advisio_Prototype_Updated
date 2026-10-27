import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(path) && !/\.test\./.test(path)
        ? [path]
        : [];
  });
}
describe("researcher case creation boundary", () => {
  it("contains no frontend manual registration or legacy participation creation call", () => {
    const forbidden: string[] = [];
    for (const file of sources("src")) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "post"
        ) {
          const endpoint = node.arguments[0];
          if (
            endpoint &&
            ((ts.isStringLiteralLike(endpoint) &&
              endpoint.text === "/api/research") ||
              /\/api\/workflows\/.*\/participation/.test(
                endpoint.getText(source),
              ))
          )
            forbidden.push(file);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(forbidden).toEqual([]);
  });
});
