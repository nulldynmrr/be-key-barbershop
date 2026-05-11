module.exports = {
  templateFields: [
    `  "risiko_gaya": {`,
    `    "persentase_risiko": number_0_to_100,`,
    `    "level_risiko": "Low Risk"|"Medium Risk"|"High Risk",`,
    `    "deskripsi_risiko": string,`,
    `    "faktor_risiko": [string]`,
    `  }`
  ],
  systemSections: [
    `- Evaluasi risiko gaya rambut terhadap struktur wajah: seberapa besar kemungkinan gaya utama tidak cocok atau sulit dipertahankan. Beri persentase risiko (0=sangat aman, 100=sangat berisiko), level, deskripsi, dan faktor-faktor risikonya.`
  ],
  promptSections: [
    `- Isi 'risiko_gaya' dengan 'persentase_risiko', 'level_risiko', 'deskripsi_risiko', and 'faktor_risiko' (array string).`
  ]
};
