/**
 * Normalisasi `AIMessage.content` dari berbagai provider (OpenAI, Gemini via MAIA, dll.)
 * ke satu string teks untuk ekstraksi JSON.
 */
function normalizeMessageContentToString(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (block == null) continue;
      if (typeof block === "string") {
        parts.push(block);
        continue;
      }
      if (typeof block === "object") {
        if (typeof block.text === "string") parts.push(block.text);
        else if (typeof block.content === "string") parts.push(block.content);
        else if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
      }
    }
    return parts.join("\n").trim();
  }
  if (typeof content === "object" && content !== null && !Array.isArray(content)) {
    if (Array.isArray(content.parts)) return normalizeMessageContentToString(content.parts);
    if (typeof content.text === "string") return content.text;
  }
  return String(content);
}

/**
 * Ambil substring JSON object pertama dengan penghitung kurung (tahan `}` di dalam string sederhana kurang baik,
 * tapi lebih baik daripada lastIndexOf untuk nested object).
 */
function extractFirstBalancedJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function stripMarkdownFences(text) {
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function stripTrailingCommas(jsonStr) {
  return jsonStr.replace(/,\s*([\}\]])/g, "$1");
}

const STATUS_RAMBUT = new Set(["Botak", "Tertutup", "Normal"]);

/** Pastikan UI tidak menampilkan "-" untuk tipe rambut: isi dari field lain atau default masuk akal. */
function inferJenisRambut(raw) {
  const direct = String(raw.jenis_rambut ?? raw.jenisRambut ?? raw.hair_type ?? raw.tipe_rambut ?? "").trim();
  if (direct && direct !== "-" && direct !== "—" && direct.toLowerCase() !== "n/a" && direct.toLowerCase() !== "unknown")
    return direct;

  const kt = String(raw.ketebalan_rambut ?? "").toLowerCase();
  const kondisi = String(raw.kondisi_rambut ?? "").toLowerCase();
  const desk = String(raw.deskripsi_bentuk_wajah ?? "").toLowerCase();

  const blob = `${kt} ${kondisi} ${desk}`;
  if (blob.includes("ikal") || blob.includes("wave") || blob.includes("bergelombang")) return "Ikal / bergelombang";
  if (blob.includes("keriting") || blob.includes("curly") || blob.includes("kribo")) return "Keriting";
  if (blob.includes("lurus") || blob.includes("straight")) return "Lurus";
  if (blob.includes("tipis") || blob.includes("fine")) return "Lurus halus (fine)";
  if (blob.includes("tebal") || blob.includes("kasar") || blob.includes("coarse")) return "Lurus tegas / kasar tekstur";
  if (raw.status_rambut === "Botak") return "Sangat tipis / tidak terlihat";
  if (raw.status_rambut === "Tertutup") return "Tertutup (topi/kerudung) — tipe tidak terlihat penuh";

  return "Lurus medium (standar)";
}

/**
 * Perbaiki field wajib agar lolos Zod setelah model mengembalikan JSON longgar / parsial.
 */
function salvageFaceAnalysisShape(raw) {
  if (!raw || typeof raw !== "object") return null;

  const recsIn = Array.isArray(raw.rekomendasi_gaya) ? raw.rekomendasi_gaya : [];
  const rekomendasi_gaya = recsIn
    .slice(0, 8)
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const nama = String(r.nama_gaya ?? r.nama ?? r.style ?? "Gaya rambut").trim() || "Gaya rambut";
      const alasan = String(r.alasan ?? r.reason ?? "Sesuai proporsi wajah.").trim();
      const ms = Number(r.match_score ?? r.score ?? 80);
      const match_score = Number.isFinite(ms) ? Math.min(100, Math.max(0, ms)) : 80;
      return { nama_gaya: nama, alasan, match_score };
    })
    .filter(Boolean);

  while (rekomendasi_gaya.length < 5) {
    rekomendasi_gaya.push({
      nama_gaya: `Rekomendasi ${rekomendasi_gaya.length + 1}`,
      alasan: "Lengkapi berdasarkan bentuk wajah.",
      match_score: 70 - rekomendasi_gaya.length,
    });
  }

  let status_rambut = raw.status_rambut;
  if (!STATUS_RAMBUT.has(status_rambut)) status_rambut = "Normal";

  const jw = Number(raw.jumlah_wajah);
  const jumlah_wajah = Number.isFinite(jw) && jw >= 1 ? Math.floor(jw) : 1;

  const ac = Number(raw.ai_confidence);
  const ai_confidence = Number.isFinite(ac) ? Math.min(100, Math.max(0, ac)) : 75;

  return {
    ...raw,
    kualitas_foto_ok: typeof raw.kualitas_foto_ok === "boolean" ? raw.kualitas_foto_ok : true,
    alasan_kualitas: raw.alasan_kualitas == null ? null : String(raw.alasan_kualitas),
    jumlah_wajah,
    gender: String(raw.gender || "Tidak diketahui"),
    status_rambut,
    bentuk_wajah: String(raw.bentuk_wajah || "Tidak diketahui"),
    deskripsi_bentuk_wajah: String(raw.deskripsi_bentuk_wajah || ""),
    jenis_rambut: inferJenisRambut(raw),
    ketebalan_rambut: String(raw.ketebalan_rambut || "Sedang"),
    ai_confidence,
    rekomendasi_gaya: rekomendasi_gaya.slice(0, 5),
    catatan_stylist: String(raw.catatan_stylist || "Analisis selesai."),
  };
}

/**
 * @param {string} rawText — teks dari model (boleh berisi markdown / noise)
 * @param {import("zod").ZodType} schema — FaceAnalysisOutputSchema
 * @returns {{ data: object } | { error: Error }}
 */
function parseFaceAnalysisFromLlmText(rawText, schema) {
  const trimmed = stripMarkdownFences(String(rawText || "").trim());
  if (!trimmed) return { error: new Error("Konten respons kosong.") };

  let jsonStr = extractFirstBalancedJsonObject(trimmed);
  if (!jsonStr) {
    const s = trimmed.indexOf("{");
    const e = trimmed.lastIndexOf("}");
    if (s !== -1 && e > s) jsonStr = stripTrailingCommas(trimmed.slice(s, e + 1));
  } else {
    jsonStr = stripTrailingCommas(jsonStr);
  }

  if (!jsonStr) return { error: new Error("Tidak ada objek JSON di respons.") };

  let manualParsed;
  try {
    manualParsed = JSON.parse(jsonStr);
  } catch (e) {
    return { error: e };
  }

  const salvaged = salvageFaceAnalysisShape(manualParsed);
  const validated = schema.safeParse(salvaged);
  if (validated.success) return { data: validated.data };

  const retry = schema.safeParse(salvageFaceAnalysisShape({ ...manualParsed, ...salvaged }));
  if (retry.success) return { data: retry.data };

  return { error: new Error(validated.error?.message || "Validasi schema gagal.") };
}

module.exports = {
  normalizeMessageContentToString,
  extractFirstBalancedJsonObject,
  parseFaceAnalysisFromLlmText,
  salvageFaceAnalysisShape,
  inferJenisRambut,
};
