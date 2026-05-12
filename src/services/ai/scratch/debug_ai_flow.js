const { buildDynamicPrompt } = require('../core/promptBuilder');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAiFlow() {
  console.log('\n======================================================');
  console.log('🚀 STEP 1: PERAKITAN TEMPLATE (PROMPT BUILDER)');
  console.log('======================================================\n');

  // Simulasi fitur aktif untuk paket Premium
  const activeFeatures = [
    "STANDARD_SCAN",
    "FACE_HEATMAP",
    "SYMMETRY",
    "ADV_MAPPING",
    "HAIR_ANALYSIS",
    "RISK_ANALYSIS",
    "BARBER_INSTRUCTIONS",
    "TREND_ANALYSIS"
  ];

  const { systemInstruction, promptText } = buildDynamicPrompt(activeFeatures);

  console.log('--- [SYSTEM INSTRUCTION] ---');
  console.log(systemInstruction);
  
  console.log('\n--- [USER PROMPT TEXT] ---');
  console.log(promptText);

  console.log('\n======================================================');
  console.log('🤖 STEP 2: BAGAIMANA AI BERBICARA (OUTPUT NYATA)');
  console.log('======================================================\n');

  try {
    const latestRes = await prisma.aIGeneration.findFirst({
      orderBy: { tgl_generate: 'desc' }
    });

    if (latestRes) {
      const hasil = latestRes.hasil_analisis;
      
      console.log('--- [CONTOH CATATAN STYLIST] ---');
      console.log(`AI: "${hasil.catatan_stylist}"`);
      
      console.log('\n--- [CONTOH INSTRUKSI BARBER] ---');
      if (hasil.instruksi_barber_detail) {
        console.log(`Teknik: ${hasil.instruksi_barber_detail.teknik_potong}`);
        console.log(`Produk: ${hasil.instruksi_barber_detail.produk_saran}`);
      } else {
        console.log(`AI: "${hasil.instruksi_barber}"`);
      }

      console.log('\n--- [JSON LENGKAP YANG DIKIRIM AI] ---');
      console.log(JSON.stringify(hasil, null, 2));

    } else {
      console.log('Belum ada data di database untuk ditampilkan.');
    }
  } catch (err) {
    console.error('Gagal mengambil data dari DB:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugAiFlow();
