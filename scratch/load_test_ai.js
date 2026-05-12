const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// CONFIGURATION
const API_URL = 'http://localhost:5000/api/v1/ai/analyze-face';
const JWT_SECRET = "k3yB@rb3r_S3cr3t_14!_skdjsSJAJIUMKSDKIUMJ@AAD_IUMT3LYU_42_sdfjJA9s8d7f6g5h4j3k2l1";
const TEST_USER_ID = 'b84a3a9a-34e3-4f22-aadf-25de9fb864d8';
const CONCURRENT_REQUESTS = 10;
const TEST_IMAGE_PATH = path.join(__dirname, '..', 'uploads', 'ai_results', '1778551359435-potret-gadis-asia-muda-yang-terisolasi53876-70968.webp');

// Generate Token
const token = jwt.sign({ id: TEST_USER_ID, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

async function sendRequest(id) {
  console.log(`[Request ${id}] Starting...`);
  const form = new FormData();
  form.append('image', fs.createReadStream(TEST_IMAGE_PATH));
  form.append('requestedFeatures', JSON.stringify(['STANDARD_SCAN', 'FACE_HEATMAP', 'VIRTUAL_TRY_ON']));

  const startTime = Date.now();
  try {
    const response = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      timeout: 60000 // 60s timeout
    });
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Request ${id}] SUCCESS in ${duration}s: ${response.data.message}`);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    const msg = error.response?.data?.message || error.message;
    console.error(`[Request ${id}] FAILED in ${duration}s: ${msg}`);
  }
}

async function runTest() {
  console.log(`🚀 Starting Load Test: ${CONCURRENT_REQUESTS} concurrent requests...`);
  console.log(`⚠️  Warning: This will consume coins and AI budget!`);
  
  const startTime = Date.now();
  const requests = [];
  for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
    requests.push(sendRequest(i));
  }

  await Promise.all(requests);
  const totalDuration = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Load Test Finished in ${totalDuration}s`);
}

runTest();
