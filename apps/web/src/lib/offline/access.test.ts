import { afterEach, describe, expect, it, vi } from "vitest";
import { requiresConnection, setOfflineOnly } from "./access";
import { makeQueryClient } from "../query/query-client";

afterEach(() => {
  setOfflineOnly(false);
  vi.unstubAllGlobals();
});

describe("offline official-action protection", () => {
  it.each(["POST", "PATCH", "PUT", "DELETE"])(
    "blocks %s while disconnected",
    (method) => {
      vi.stubGlobal("navigator", { onLine: false });
      expect(requiresConnection(method, "/api/research/project/submit")).toBe(
        true,
      );
    },
  );

  it("requires online session verification before any server-backed workspace operation", () => {
    vi.stubGlobal("navigator", { onLine: true });
    setOfflineOnly(true);
    expect(requiresConnection("GET", "/api/auth/me")).toBe(false);
    expect(requiresConnection("GET", "/api/research")).toBe(true);
    expect(requiresConnection("POST", "/api/documents/sign")).toBe(true);
    setOfflineOnly(false);
    expect(requiresConnection("POST", "/api/documents/sign")).toBe(false);
  });

  it("does not queue React Query mutations for replay after reconnect", () => {
    expect(makeQueryClient().getDefaultOptions().mutations?.networkMode).toBe(
      "always",
    );
  });
});
