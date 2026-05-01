const { z } = require("zod");

exports.faceAnalysisSchema = z.object({
  requestedFeatures: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch (e) {
          return [val];
        }
      }
      return val;
    })
    .refine(
      (val) => Array.isArray(val) && val.length > 0,
      "Minimal pilih 1 fitur analisis",
    ),
});
