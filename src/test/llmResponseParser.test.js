const {
  normalizeMessageContentToString,
  parseFaceAnalysisFromLlmText,
  inferJenisRambut,
} = require("../services/ai/graph/nodes/llm/llmResponseParser");
const { FaceAnalysisOutputSchema } = require("../services/ai/schemas/analysisOutput.schema");

describe("llmResponseParser", () => {
  test("normalizes Gemini-style array content", () => {
    const s = normalizeMessageContentToString([
      { type: "text", text: "Here is JSON:\n" },
      { type: "text", text: '{"kualitas_foto_ok":true}' },
    ]);
    expect(s).toContain("kualitas_foto_ok");
  });

  test("normalizes plain string", () => {
    expect(normalizeMessageContentToString('{"a":1}')).toBe('{"a":1}');
  });

  test("parses markdown-wrapped JSON with salvage", () => {
    const raw = `\`\`\`json
{
  "kualitas_foto_ok": true,
  "alasan_kualitas": null,
  "jumlah_wajah": 1,
  "gender": "pria",
  "status_rambut": "Normal",
  "bentuk_wajah": "Oval",
  "deskripsi_bentuk_wajah": "x",
  "jenis_rambut": "lurus",
  "ketebalan_rambut": "sedang",
  "ai_confidence": 90,
  "rekomendasi_gaya": [{"nama_gaya":"French crop","alasan":"ok","match_score":88}],
  "catatan_stylist": "ok"
}
\`\`\``;
    const { data, error } = parseFaceAnalysisFromLlmText(raw, FaceAnalysisOutputSchema);
    expect(error).toBeUndefined();
    expect(data.jumlah_wajah).toBe(1);
    expect(data.rekomendasi_gaya.length).toBeGreaterThanOrEqual(5);
  });

  test("inferJenisRambut fills empty from ketebalan_rambut", () => {
    expect(inferJenisRambut({ jenis_rambut: "", ketebalan_rambut: "Ikal longgar" })).toMatch(/ikal/i);
    expect(inferJenisRambut({ jenis_rambut: "-" })).toBe("Lurus medium (standar)");
  });
});
