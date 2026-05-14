const { FEATURE_GATE_MAP, FREE_TRIAL_BLOCKED_FEATURES } = require("../services/ai/featureGateMap");
const { normalizeOpenAiBaseUrl, resolveChatCompletionsPostUrl } = require("../services/ai/core/openAiUrl");
const {
  assertValidAnalyzeUpload,
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_BYTES,
} = require("../services/ai/inputValidation");
const { normalizeOpenAiCompatibleUsage } = require("../services/ai/billing");

describe("services/ai featureGateMap", () => {
  it("memetakan semua kode fitur utama ke kolom Prisma", () => {
    expect(FEATURE_GATE_MAP.STANDARD_SCAN).toBe("featStandardScan");
    expect(FEATURE_GATE_MAP.VIRTUAL_TRY_ON).toBe("featVirtualTryOn");
    expect(Object.keys(FEATURE_GATE_MAP).length).toBeGreaterThanOrEqual(10);
  });

  it("memblokir fitur premium pada free trial", () => {
    expect(FREE_TRIAL_BLOCKED_FEATURES).toContain("ADV_MAPPING");
    expect(FREE_TRIAL_BLOCKED_FEATURES).not.toContain("STANDARD_SCAN");
  });
});

describe("services/ai openAiUrl", () => {
  const cases = [
    ["https://api.openai.com/v1/", "https://api.openai.com/v1"],
    ["https://host/v1/chat/completions", "https://host/v1"],
    ["https://host/chat/completions", "https://host"],
  ];
  it.each(cases)("normalizeOpenAiBaseUrl(%j) → %j", (input, expected) => {
    expect(normalizeOpenAiBaseUrl(input)).toBe(expected);
  });

  it("mengembalikan undefined untuk input kosong", () => {
    expect(normalizeOpenAiBaseUrl(undefined)).toBeUndefined();
    expect(normalizeOpenAiBaseUrl("")).toBe("");
  });

  const postCases = [
    ["https://api.maiarouter.ai/v1", "https://api.maiarouter.ai/v1/chat/completions"],
    ["https://api.maiarouter.ai/v1/", "https://api.maiarouter.ai/v1/chat/completions"],
    [
      "https://api.maiarouter.ai/v1/chat/completions",
      "https://api.maiarouter.ai/v1/chat/completions",
    ],
    ["https://api.maiarouter.ai", "https://api.maiarouter.ai/v1/chat/completions"],
  ];
  it.each(postCases)("resolveChatCompletionsPostUrl(%j) → %j", (input, expected) => {
    expect(resolveChatCompletionsPostUrl(input)).toBe(expected);
  });
});

describe("services/ai billing.normalizeOpenAiCompatibleUsage", () => {
  it("memetakan OpenAI-style usage", () => {
    expect(
      normalizeOpenAiCompatibleUsage({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }),
    ).toEqual({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
  });

  it("memetakan Gemini / MAIA alias token", () => {
    expect(
      normalizeOpenAiCompatibleUsage({
        input_tokens: 100,
        output_tokens: 200,
        totalTokenCount: 0,
      }),
    ).toEqual({ prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 });
  });

  it("menjumlahkan total dari prompt+completion jika total tidak ada", () => {
    expect(normalizeOpenAiCompatibleUsage({ prompt_tokens: 5, completion_tokens: 7 })).toEqual({
      prompt_tokens: 5,
      completion_tokens: 7,
      total_tokens: 12,
    });
  });
});

describe("services/ai inputValidation", () => {
  const minimalBuffer = Buffer.from([0xff, 0xd8, 0xff]);

  it("melewati state valid", () => {
    expect(() =>
      assertValidAnalyzeUpload({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        file: { buffer: minimalBuffer, mimetype: "image/jpeg" },
        requestedFeatures: ["STANDARD_SCAN"],
      }),
    ).not.toThrow();
  });

  it("menolak userId non-string", () => {
    expect(() =>
      assertValidAnalyzeUpload({
        userId: 123,
        file: { buffer: minimalBuffer, mimetype: "image/jpeg" },
        requestedFeatures: [],
      }),
    ).toThrow(/pengguna tidak dikenali/i);
  });

  it("menolak buffer kosong", () => {
    expect(() =>
      assertValidAnalyzeUpload({
        userId: "u1",
        file: { buffer: Buffer.alloc(0), mimetype: "image/jpeg" },
        requestedFeatures: [],
      }),
    ).toThrow(/tidak valid/i);
  });

  it("menolak ukuran melebihi batas", () => {
    expect(() =>
      assertValidAnalyzeUpload({
        userId: "u1",
        file: { buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1), mimetype: "image/jpeg" },
        requestedFeatures: [],
      }),
    ).toThrow(/melebihi batas/i);
  });

  it("menolak MIME di luar allowlist bila diset", () => {
    expect(() =>
      assertValidAnalyzeUpload({
        userId: "u1",
        file: { buffer: minimalBuffer, mimetype: "application/pdf" },
        requestedFeatures: [],
      }),
    ).toThrow(/tidak didukung/i);
  });

  it("mengizinkan MIME kosong (Sharp/route bisa mengisi nanti)", () => {
    expect(() =>
      assertValidAnalyzeUpload({
        userId: "u1",
        file: { buffer: minimalBuffer },
        requestedFeatures: ["STANDARD_SCAN"],
      }),
    ).not.toThrow();
  });

  it("menolak requestedFeatures bukan array", () => {
    expect(() =>
      assertValidAnalyzeUpload({
        userId: "u1",
        file: { buffer: minimalBuffer, mimetype: "image/jpeg" },
        requestedFeatures: "STANDARD_SCAN",
      }),
    ).toThrow(/Parameter fitur/i);
  });

  it("ALLOWED_IMAGE_MIMES mencakup format vision umum", () => {
    expect(ALLOWED_IMAGE_MIMES.has("image/webp")).toBe(true);
    expect(ALLOWED_IMAGE_MIMES.has("image/svg+xml")).toBe(false);
  });
});
