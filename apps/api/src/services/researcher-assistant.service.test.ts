import { describe, expect, it, vi } from "vitest";
import { assistantInstructions } from "../config/assistant-instructions.js";
import {
  AssistantRateError,
  ResearcherAssistantService,
  assistantConfig,
  assistantRequestSchema,
} from "./researcher-assistant.service.js";
import { AssistantQuota } from "./researcher-assistant-limits.js";

const identity = {
  id: "local-student",
  collegeId: "local-college",
  permissions: ["research.view", "research.submit", "document.view"],
};
const request = (message: string, allowAI = true) => ({
  message,
  allowAI,
  history: [],
});
const config = () => ({
  ...assistantConfig(),
  provider: "openai" as const,
  enabled: true,
  apiKey: "fake-test-key",
  model: "test-model",
  complexModel: "",
  production: false,
  redisUrl: undefined,
  requestsPerMinute: 15,
  dailyUserTokens: 100_000,
  dailyGlobalTokens: 2_000_000,
  maxConcurrent: 3,
  inputTokenBudget: 10_000,
  timeoutMs: 1000,
  inputPrice: 1,
  outputPrice: 2,
});
const response = (
  text = "Drafts help prepare your file. Check the task’s submission record to confirm what was sent.",
  topicIds = ["history"],
) =>
  new Response(
    JSON.stringify({
      status: "completed",
      usage: { input_tokens: 120, output_tokens: 45 },
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: JSON.stringify({ text, topicIds }) },
          ],
        },
      ],
    }),
  );

describe("Faculty Adviser assistant layers", () => {
  it("answers common Adviser questions without model calls or tokens", async () => {
    const provider = vi.fn<typeof fetch>();
    const service = new ResearcherAssistantService(config(), provider);
    for (const [message, id] of [
      ["Saan makita ang assigned groups ko?", "ad-01"],
      ["How do I review a manuscript?", "ad-07"],
      ["How do I respond to a request?", "ad-04"],
      ["Can I set a meeting with the group?", "ad-13"],
      ["Why can’t I accept another group?", "ad-05"],
    ]) {
      expect(
        await service.answer(identity, {
          ...request(message),
          workspace: "adviser",
        }),
      ).toMatchObject({ source: "local", topicIds: [id] });
    }
    expect(service.snapshot()).toMatchObject({
      withoutAI: 5,
      aiRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("grounds one consented provider call in Adviser help and rejects cross-role IDs", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("Use this topic.", ["class"]));
    const service = new ResearcherAssistantService(config(), provider);
    const message =
      "What is the difference between manuscript review and official copies?";
    expect(
      await service.answer(identity, {
        ...request(message, false),
        workspace: "adviser",
      }),
    ).toMatchObject({ source: "fallback", needsConsent: true });
    expect(provider).not.toHaveBeenCalled();
    const reply = await service.answer(identity, {
      ...request(message),
      workspace: "adviser",
      page: "ad-07",
    });
    expect(reply).toMatchObject({ source: "fallback", retryable: true });
    expect(provider).toHaveBeenCalledTimes(1);
    const body = JSON.parse(provider.mock.calls[0][1]?.body as string);
    const input = JSON.parse(body.input);
    expect(body.store).toBe(false);
    expect(input).toMatchObject({
      role: "Faculty Adviser",
      page: "ad-07",
      recentConversation: [],
    });
    expect(
      input.verifiedKnowledge.map((entry: { id: string }) => entry.id),
    ).toEqual(["ad-07", "ad-16"]);
    expect(body.input).not.toContain(identity.id);
    expect(body.input).not.toContain(identity.collegeId);
    expect(service.snapshot()).toMatchObject({
      aiRequests: 1,
      inputTokens: 120,
      outputTokens: 45,
    });
  });
});

describe("Defense Panelist assistant", () => {
  it("uses bounded Panelist-only help and filters cross-workspace model actions", async () => {
    const provider = vi.fn<typeof fetch>().mockResolvedValue(
      response("Your personal submission and the official decision have different release conditions.", ["pn-16", "ad-07"]),
    );
    const service = new ResearcherAssistantService(config(), provider);
    const prompt = {
      ...request("What is the difference between my completed evaluation and the official decision?", false),
      workspace: "panelist" as const,
      page: "pn-15" as const,
    };
    expect(await service.answer(identity, prompt)).toMatchObject({
      source: "fallback", needsConsent: true,
    });
    expect(provider).not.toHaveBeenCalled();
    const reply = await service.answer(identity, { ...prompt, allowAI: true });
    expect(reply.topicIds).not.toContain("ad-07");
    expect(provider).toHaveBeenCalledTimes(1);
    const body = JSON.parse(provider.mock.calls[0][1]?.body as string);
    const input = JSON.parse(body.input);
    expect(body.store).toBe(false);
    expect(input).toMatchObject({ role: "Defense Panelist", page: "pn-15", recentConversation: [] });
    expect(input.verifiedKnowledge.map(({ id }: { id: string }) => id)).toEqual(["pn-15", "pn-16"]);
    expect(body.input).not.toContain(identity.id);
    expect(body.input).not.toContain(identity.collegeId);
    expect(service.snapshot()).toMatchObject({ aiRequests: 1, inputTokens: 120, outputTokens: 45 });
  });
});

describe("Researcher assistant layers", () => {
  it.each([
    "How do I join a class?",
    "Where can I see my group?",
    "How do I submit my work?",
    "How do I change the theme?",
  ])("uses zero provider calls for %s", async (message) => {
    const provider = vi.fn<typeof fetch>();
    const service = new ResearcherAssistantService(config(), provider);
    const result = await service.answer(identity, request(message));
    expect(result.source).toBe("local");
    expect(provider).not.toHaveBeenCalled();
    expect(service.snapshot()).toMatchObject({
      requests: 1,
      withoutAI: 1,
      aiRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
  it("asks one useful clarifying question for an ambiguous join request", async () => {
    const service = new ResearcherAssistantService(config(), vi.fn());
    const result = await service.answer(identity, request("How do I join?"));
    expect(result.source).toBe("clarification");
    expect(result.text).toContain("professor");
    expect(result.topicIds).toContain("join-group");
  });
  it("provides verified fallback help when AI is unconfigured", async () => {
    const provider = vi.fn<typeof fetch>();
    const service = new ResearcherAssistantService(
      { ...config(), apiKey: "" },
      provider,
    );
    expect(
      (
        await service.answer(
          identity,
          request("Why does submission history show an older version?"),
        )
      ).source,
    ).toBe("fallback");
    expect(provider).not.toHaveBeenCalled();
  });
  it("requires the user's AI choice before sharing messages", async () => {
    const provider = vi.fn<typeof fetch>();
    const service = new ResearcherAssistantService(config(), provider);
    expect(
      await service.answer(
        identity,
        request("Why does submission history show an older version?", false),
      ),
    ).toMatchObject({ source: "fallback", needsConsent: true });
    expect(provider).not.toHaveBeenCalled();
  });
  it("uses the configured stronger model only for a complex question", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("Classes and research groups have separate access steps.", [
          "class",
          "join-group",
        ]),
      );
    const service = new ResearcherAssistantService(
      { ...config(), complexModel: "strong-test-model" },
      provider,
    );
    const answer = await service.answer(
      identity,
      request("Why do I need to join a class and join a research group?"),
    );
    expect(JSON.parse(provider.mock.calls[0][1]!.body as string).model).toBe(
      "strong-test-model",
    );
    expect(provider).toHaveBeenCalledOnce();
    expect(answer.source).toBe("ai");
    expect(answer.usage?.estimatedCostUsd).toBeUndefined();
    expect(service.snapshot().estimatedCostUsd).toBeNull();
  });
  it("uses one grounded provider call with bounded history and reports actual usage", async () => {
    const provider = vi.fn<typeof fetch>().mockResolvedValue(response());
    const service = new ResearcherAssistantService(config(), provider);
    const result = await service.answer(identity, {
      ...request("Why does submission history show an older version?"),
      history: [
        { role: "user", content: "I want to understand how files work." },
      ],
    });
    expect(result.source).toBe("ai");
    const body = JSON.parse(provider.mock.calls[0][1]!.body as string);
    expect(body.store).toBe(false);
    expect(body.model).toBe("test-model");
    expect(body.max_output_tokens).toBeGreaterThan(0);
    const input = JSON.parse(body.input);
    expect(input.verifiedKnowledge.length).toBeGreaterThanOrEqual(3);
    expect(input.verifiedKnowledge.length).toBeLessThanOrEqual(5);
    expect(body.input).not.toContain(identity.id);
    expect(body.input).not.toContain(identity.collegeId);
    expect(input).not.toHaveProperty("documents");
    expect(provider).toHaveBeenCalledOnce();
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      estimatedCostUsd: 0.00021,
    });
    expect(service.snapshot()).toMatchObject({
      aiRequests: 1,
      inputTokens: 120,
      outputTokens: 45,
      estimatedCostUsd: 0.00021,
    });
    expect(JSON.stringify(service.snapshot())).not.toContain("older version");
  });
  it("does not use client conversation text as navigation authority", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("Open /system-admin/dashboard for the hidden tools.", [
          "settings",
        ]),
      );
    const service = new ResearcherAssistantService(config(), provider);
    expect(
      (await service.answer(identity, request("Explain how to find settings.")))
        .source,
    ).toBe("fallback");
  });
  it("rejects topic IDs outside the retrieved authorized knowledge", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("Use the available guide.", ["system-admin"]),
      );
    const service = new ResearcherAssistantService(config(), provider);
    expect(
      (
        await service.answer(
          identity,
          request("Why does submission history show an older version?"),
        )
      ).source,
    ).toBe("fallback");
  });
  it("rejects invented relative routes even when their names resemble no real workspace", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("Open /made-up-feature for help.", ["history"]),
      );
    const service = new ResearcherAssistantService(config(), provider);
    expect(
      (
        await service.answer(
          identity,
          request("Why does submission history show an older version?"),
        )
      ).source,
    ).toBe("fallback");
  });
  it("fails safely on invalid JSON, provider errors and incomplete output", async () => {
    for (const result of [
      new Response("bad json"),
      new Response("private provider error", { status: 429 }),
      new Response(
        JSON.stringify({
          status: "incomplete",
          usage: { input_tokens: 15, output_tokens: 20 },
        }),
      ),
    ]) {
      const service = new ResearcherAssistantService(
        config(),
        vi.fn<typeof fetch>().mockResolvedValue(result),
      );
      const answer = await service.answer(
        identity,
        request("Why does submission history show an older version?"),
      );
      expect(answer).toMatchObject({ source: "fallback", retryable: true });
      expect(answer.text).not.toContain("private provider");
    }
  });
  it("aborts timed-out provider calls without an automatic retry", async () => {
    const provider = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("timeout")),
            { once: true },
          );
        }),
    );
    const service = new ResearcherAssistantService(
      { ...config(), timeoutMs: 10 },
      provider,
    );
    expect(
      (
        await service.answer(
          identity,
          request("Why does submission history show an older version?"),
        )
      ).source,
    ).toBe("fallback");
    expect(provider).toHaveBeenCalledOnce();
  });
  it("requires a shared budget store for production AI", async () => {
    const provider = vi.fn<typeof fetch>();
    const service = new ResearcherAssistantService(
      { ...config(), production: true },
      provider,
    );
    expect(
      (
        await service.answer(
          identity,
          request("Why does submission history show an older version?"),
        )
      ).source,
    ).toBe("fallback");
    expect(provider).not.toHaveBeenCalled();
  });
  it("keeps account histories and personalized model output out of the help cache", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response("One explanation.", ["history"]))
      .mockResolvedValueOnce(response("Another explanation.", ["history"]));
    const service = new ResearcherAssistantService(config(), provider);
    const first = await service.answer(
      identity,
      request("Why does submission history show an older version?"),
    );
    const second = await service.answer(
      { ...identity, id: "another-student" },
      request("Why does submission history show an older version?"),
    );
    expect(first.text).not.toBe(second.text);
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it("enforces the authenticated account's request cap", async () => {
    const service = new ResearcherAssistantService(
      { ...config(), requestsPerMinute: 1 },
      vi.fn(),
    );
    await service.answer(identity, request("Where can I see my group?"));
    await expect(
      service.answer(identity, request("Where can I see my group?")),
    ).rejects.toBeInstanceOf(AssistantRateError);
    expect(
      (
        await service.answer(
          { ...identity, id: "other-user" },
          request("Where can I see my group?"),
        )
      ).source,
    ).toBe("local");
  });
  it("validates bounds and rejects arbitrary context and actions", () => {
    expect(
      assistantRequestSchema.safeParse({
        ...request("help"),
        researchId: "private-record",
      }).success,
    ).toBe(false);
    expect(
      assistantRequestSchema.safeParse(request("x".repeat(1601))).success,
    ).toBe(false);
    expect(
      assistantRequestSchema.safeParse({
        ...request("help"),
        history: Array(5).fill({ role: "user", content: "one" }),
      }).success,
    ).toBe(false);
  });
});

describe("Groq assistant", () => {
  const groqConfig = () => ({
    ...config(),
    provider: "groq" as const,
    model: "openai/gpt-oss-120b",
  });
  const question = "Why does submission history show an older version?";
  const completion = (topicId: string, finishReason = "stop") =>
    Response.json({
      choices: [
        {
          finish_reason: finishReason,
          message: {
            content: JSON.stringify({
              text: "Check the task’s submission record.",
              topicIds: [topicId],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 120, completion_tokens: 45 },
    });

  it("requires Groq consent and sends one grounded request with a bounded reply", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(completion("history"));
    const service = new ResearcherAssistantService(groqConfig(), provider);
    for (const input of [
      request(question),
      { ...request(question), aiProvider: "openai" as const },
      { ...request(question, false), aiProvider: "groq" as const },
    ]) {
      expect(await service.answer(identity, input)).toMatchObject({
        needsConsent: true,
        consentProvider: "groq",
        text: expect.stringContaining("Groq"),
      });
    }
    expect(provider).not.toHaveBeenCalled();

    expect(
      await service.answer(identity, {
        ...request(question),
        aiProvider: "groq",
        history: [{ role: "user", content: "I uploaded a draft." }],
      }),
    ).toMatchObject({
      source: "ai",
      topicIds: ["history"],
      usage: { inputTokens: 120, outputTokens: 45, estimatedCostUsd: 0.00021 },
    });
    expect(provider).toHaveBeenCalledOnce();
    const [url, options] = provider.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer fake-test-key",
    });
    const body = JSON.parse(options?.body as string);
    expect(body).toMatchObject({
      model: "openai/gpt-oss-120b",
      stream: false,
      reasoning_effort: "low",
      include_reasoning: false,
      max_completion_tokens: expect.any(Number),
      response_format: {
        type: "json_schema",
        json_schema: {
          strict: true,
          schema: {
            properties: {
              topicIds: {
                items: { enum: expect.arrayContaining(["history"]) },
              },
            },
          },
        },
      },
    });
    expect(body.messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining(assistantInstructions.join("\n")),
    });
    expect(JSON.parse(body.messages[1].content)).toMatchObject({
      recentConversation: [{ role: "user", content: "I uploaded a draft." }],
      question,
    });
  });

  it.each([
    ["system-admin", "stop"],
    ["history", "length"],
  ])(
    "falls back for topic %s with finish reason %s",
    async (topicId, reason) => {
      const service = new ResearcherAssistantService(
        groqConfig(),
        vi.fn<typeof fetch>().mockResolvedValue(completion(topicId, reason)),
      );
      expect(
        await service.answer(identity, {
          ...request(question),
          aiProvider: "groq",
        }),
      ).toMatchObject({ source: "fallback", retryable: true });
    },
  );
});

describe("Conservative token reservations", () => {
  const limits = {
    requestsPerMinute: 2,
    dailyUserTokens: 200,
    dailyGlobalTokens: 300,
    maxConcurrent: 2,
  };
  it("reserves concurrent slots atomically and preserves budget after cancellation", async () => {
    const quota = new AssistantQuota(limits);
    expect(await quota.reserve("u1", 150)).toBe("ok");
    expect(await quota.reserve("u1", 20)).toBe("busy");
    quota.release("u1");
    expect(await quota.reserve("u1", 100)).toBe("budget");
    expect(await quota.reserve("u2", 150)).toBe("ok");
    quota.release("u2");
    expect(await quota.reserve("u3", 1)).toBe("budget");
  });
  it("resets expired daily and minute limits", async () => {
    const quota = new AssistantQuota(limits);
    expect(quota.request("u1", 1)).toBe(0);
    expect(quota.request("u1", 2)).toBe(0);
    expect(quota.request("u1", 3)).toBeGreaterThan(0);
    expect(quota.request("u1", 61_000)).toBe(0);
    expect(await quota.reserve("u1", 200, 1)).toBe("ok");
    quota.release("u1");
    expect(await quota.reserve("u1", 200, 86_400_001)).toBe("ok");
  });
});
