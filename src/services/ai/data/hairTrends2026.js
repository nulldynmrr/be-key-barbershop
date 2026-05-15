/**
 * Ground truth tren gaya (kurasi statis). LLM hanya memetakan ke wajah klien, bukan mengarang angka tren.
 * Update Mei 2026 dari sumber lokal (barbershop demand, TikTok/IG viral, artikel Popbela, Tirto, Kompas, dll).
 */
module.exports = {
  globalTrends2026: [
    // CATEGORY: SHORT / CROP
    { nama: "Textured Crop", delta: "+42%", category: "Pendek", gender: "Pria", cocok_wajah: ["Oval", "Bulat", "Diamond"], cocok_rambut: ["Tebal", "Normal"], source: "Barbershop demand 2026" },
    { nama: "Warrior Cut", delta: "+48%", category: "Pendek", gender: "Pria", cocok_wajah: ["Kotak", "Lonjong", "Oval"], cocok_rambut: ["Ikal", "Lurus Tebal"], source: "Viral 2026" },
    { nama: "Modern Buzz Cut", delta: "+29%", category: "Sangat Pendek", gender: "Pria", cocok_wajah: ["Oval", "Kotak"], cocok_rambut: ["Semua"], source: "Clean look 2026" },
    { nama: "French Crop Fade", delta: "+19%", category: "Pendek", gender: "Pria", cocok_wajah: ["Oval", "Bulat", "Diamond"], cocok_rambut: ["Lurus", "Normal"], source: "Urban Asia" },
    
    // CATEGORY: MEDIUM / K-STYLE
    { nama: "Modern Two Block", delta: "+39%", category: "Medium", gender: "Pria", cocok_wajah: ["Oval", "Hati", "Diamond"], cocok_rambut: ["Lurus", "Ikal Halus"], source: "K-Influence" },
    { nama: "Comma Hair / Korean Curtain", delta: "+37%", category: "Medium", gender: "Pria", cocok_wajah: ["Oval", "Hati", "Diamond"], cocok_rambut: ["Lurus", "Mudah diatur"], source: "K-Style 2026" },
    { nama: "Korean Perm (Perm Revival)", delta: "+44%", category: "Medium/Panjang", gender: "Pria", cocok_wajah: ["Oval", "Diamond", "Lonjong"], cocok_rambut: ["Halus", "Tipis (untuk volume)"], source: "Perm Demand 2026" },
    { nama: "Curtain Bangs Male", delta: "+35%", category: "Medium", gender: "Pria", cocok_wajah: ["Oval", "Hati", "Diamond"], cocok_rambut: ["Lurus", "Ikal"], source: "Idol Grooming" },

    // CATEGORY: TEXTURED / LONG / EDGY
    { nama: "Shaggy Layers", delta: "+26%", category: "Panjang", gender: "Wanita", cocok_wajah: ["Oval", "Kotak", "Hati"], cocok_rambut: ["Tebal", "Bertekstur"], source: "Natural Movement" },
    { nama: "Modern Mullet Refined", delta: "+31%", category: "Medium/Panjang", gender: "Pria", cocok_wajah: ["Oval", "Lonjong", "Hati"], cocok_rambut: ["Ikal", "Tebal"], source: "Social cycles" },
    { nama: "Wolf Cut Male Edition", delta: "+22%", category: "Medium/Panjang", gender: "Pria", cocok_wajah: ["Oval", "Lonjong", "Hati"], cocok_rambut: ["Ikal", "Bergelombang"], source: "Gen Z Viral" },
    { nama: "Messy Fringe / Boy Bangs", delta: "+34%", category: "Medium", gender: "Pria", cocok_wajah: ["Oval", "Lonjong", "Diamond"], cocok_rambut: ["Halus", "Lurus"], source: "Soft Fringe 2026" },

    // CATEGORY: CLASSIC / PROFESSIONAL
    { nama: "Low Taper Fade", delta: "+33%", category: "Klasik", gender: "Pria", cocok_wajah: ["Semua"], cocok_rambut: ["Semua"], source: "Barber Staple" },
    { nama: "Crew Cut Modern", delta: "+25%", category: "Klasik", gender: "Pria", cocok_wajah: ["Oval", "Kotak", "Bulat"], cocok_rambut: ["Tebal", "Kaku"], source: "Low Maintenance" },
    { nama: "Ivy League / Side Part Taper", delta: "+21%", category: "Klasik", gender: "Pria", cocok_wajah: ["Oval", "Kotak", "Lonjong"], cocok_rambut: ["Lurus", "Normal"], source: "Preppy Modern" },
    { nama: "Slick Back Undercut", delta: "+15%", category: "Klasik", gender: "Pria", cocok_wajah: ["Oval", "Kotak", "Lonjong"], cocok_rambut: ["Lurus", "Tebal"], source: "Corporate" },

  ],
};