/**
 * Ground truth tren gaya (kurasi statis). LLM hanya memetakan ke wajah klien, bukan mengarang angka tren.
 * Update berkala dari sumber bisnis/marketing; label "proyeksi" menjelaskan batas pengetahuan model.
 */
module.exports = {
  globalTrends2026: [
    { nama: "Modern Mullet Refined", delta: "+31%", region: "Global", source: "Agregat tren 2025 → proyeksi 2026" },
    { nama: "Textured Buzz Cut", delta: "+28%", region: "Asia Tenggara", source: "Short-form video & barbershop demand" },
    { nama: "Korean Perm (Perm Revival)", delta: "+44%", region: "Southeast Asia", source: "K-beauty / perm demand regional" },
    { nama: "Wolf Cut Male Edition", delta: "+22%", region: "Global", source: "Social hairstyle cycles" },
    { nama: "French Crop Fade", delta: "+19%", region: "Urban Asia", source: "Fade + crop staple" },
    { nama: "Curtain Bangs Male", delta: "+35%", region: "East/Southeast Asia", source: "K-pop / idol grooming influence" },
    { nama: "Slick Back Undercut", delta: "+15%", region: "Professional segment", source: "Corporate-adjacent styles" },
    { nama: "Disconnected Undercut", delta: "+12%", region: "Global", source: "Classic barber revival" },
  ],
};
