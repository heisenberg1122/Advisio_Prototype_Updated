import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function fileClient(baseUrl = "https://api.example.test/") {
  vi.stubEnv("VITE_API_URL", baseUrl);
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => key === "advisio_token" ? "test-token" : null,
  });
  return (await import("./api-client")).apiClient;
}

describe("authenticated document files", () => {
  it("fetches PDFs from the configured backend with authentication", async () => {
    const client = await fileClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("%PDF-1.7\nexample", { headers: { "Content-Type": "application/pdf" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = await client.file("/api/documents/files/file-id", { expectedMimeType: "application/pdf" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/documents/files/file-id", {
      headers: { Authorization: "Bearer test-token" },
    });
    expect(blob.type).toBe("application/pdf");
    expect(await blob.text()).toBe("%PDF-1.7\nexample");
  });

  it("keeps relative URLs when using the local same-origin proxy", async () => {
    const client = await fileClient("");
    const fetchMock = vi.fn().mockResolvedValue(new Response("file"));
    vi.stubGlobal("fetch", fetchMock);

    await client.file("/api/documents/files/file-id");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents/files/file-id");
  });

  it("does not prepend the API base to an absolute file URL", async () => {
    const client = await fileClient();
    const fetchMock = vi.fn().mockResolvedValue(new Response("file"));
    vi.stubGlobal("fetch", fetchMock);

    await client.file("https://api.example.test/api/documents/files/file-id");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/api/documents/files/file-id");
  });

  it.each([
    ["text/html", "<!doctype html><html>SPA fallback</html>"],
    ["application/json", '{"error":"Unexpected response"}'],
    ["application/octet-stream", "%PDF-1.7"],
  ])("rejects a successful %s response when a PDF was requested", async (contentType, body) => {
    const client = await fileClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(body, { headers: { "Content-Type": contentType } }),
    ));

    await expect(client.file("/api/documents/files/file-id", { expectedMimeType: "application/pdf" }))
      .rejects.toThrow("unexpected file type");
  });

  it("rejects an empty PDF response", async () => {
    const client = await fileClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(null, { headers: { "Content-Type": "application/pdf" } }),
    ));

    await expect(client.file("/api/documents/files/file-id", { expectedMimeType: "application/pdf" }))
      .rejects.toThrow("file is empty");
  });

  it.each([401, 403, 404, 503])("preserves backend errors for HTTP %s", async (status) => {
    const client = await fileClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ error: "You do not have access to this document" }, { status }),
    ));

    await expect(client.file("/api/documents/files/file-id", { expectedMimeType: "application/pdf" }))
      .rejects.toMatchObject({ message: "You do not have access to this document", statusCode: status });
  });
});
