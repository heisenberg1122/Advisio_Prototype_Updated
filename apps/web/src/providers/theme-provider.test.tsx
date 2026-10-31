import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";

function CurrentAppearance() {
  const { isDark, theme } = useTheme();
  return <span data-dark={String(isDark)} data-theme={theme} />;
}

afterEach(() => vi.unstubAllGlobals());

describe("theme before the first paint", () => {
  it.each([
    ["system", true, true],
    ["system", false, false],
    ["dark", false, true],
    ["light", true, false],
  ] as const)(
    "initializes %s with system dark=%s without waiting for an effect",
    (saved, systemDark, expectedDark) => {
      const storage = new Map([
        ["advisio_token", "session"],
        ["advisio_theme:active", saved],
      ]);
      vi.stubGlobal("window", { matchMedia: () => ({ matches: systemDark }) });
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) || null,
      });
      const html = renderToStaticMarkup(
        <ThemeProvider>
          <CurrentAppearance />
        </ThemeProvider>,
      );
      expect(html).toContain(`data-dark="${expectedDark}"`);
      expect(html).toContain(`data-theme="${saved}"`);
    },
  );
});
