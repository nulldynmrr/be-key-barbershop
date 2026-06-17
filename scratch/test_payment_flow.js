const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient();
const API_URL = "http://localhost:5000/api/v1";

async function runTest() {
  console.log("=== STARTING END-TO-END TRANSACTION TEST ===");

  // 1. Find the test user
  const userId = "5cf9fe30-4a0a-47d7-8432-9eb8b8e2ca19";
  const userBefore = await prisma.user.findUnique({
    where: { id: userId },
  });
  console.log(`User: ${userBefore.nama}`);
  console.log(`Current Credits: ${userBefore.sisa_credit}`);

  // 2. Find a package to buy
  const packages = await prisma.subscriptionPackage.findMany({
    where: { status: "AKTIF" },
  });
  if (packages.length === 0) {
    console.error("No active packages found in database!");
    return;
  }
  const pkg = packages[0];
  console.log(`Selecting Package: ${pkg.namaPaket} (Price: IDR ${pkg.hargaNominal}, Coins: ${pkg.jumlahKoin})`);

  // 3. Generate JWT Token
  const token = jwt.sign(
    { id: userBefore.id, role: userBefore.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // 4. Call create-transaction API
  console.log("Calling create-transaction API...");
  let resCreate;
  try {
    resCreate = await axios.post(
      `${API_URL}/payments/create-transaction`,
      {
        package_id: pkg.id,
        amount: pkg.hargaNominal,
        nama_paket: pkg.namaPaket,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch (error) {
    console.error("Failed to create transaction:", error.response?.data || error.message);
    return;
  }

  const { success, data } = resCreate.data;
  console.log("Create Transaction Response Success:", success);
  console.log("Payment URL:", data.payment_url);
  console.log("Invoice Number:", data.invoice_number);
  console.log("Transaction ID:", data.transaction_id);

  // Verify that a transaction was created in DB with status PENDING
  const txInDb = await prisma.transaction.findUnique({
    where: { invoice_number: data.invoice_number },
  });
  console.log(`Created Transaction status in DB: ${txInDb.status} (Invoice: ${txInDb.invoice_number})`);

  // 5. Call callback webhook to simulate success
  console.log("Simulating webhook callback from mock gateway (SUCCESS)...");
  try {
    const resCallback = await axios.post(`${API_URL}/payments/callback`, {
      order_id: data.invoice_number,
      invoice_number: data.invoice_number,
      status: "SUCCESS",
      reference_id: "MOCK-REF-" + Date.now(),
    });
    console.log("Callback Response:", resCallback.data);
  } catch (error) {
    console.error("Failed to call callback webhook:", error.response?.data || error.message);
    return;
  }

  // 6. Verify User's balance update in DB
  const userAfter = await prisma.user.findUnique({
    where: { id: userId },
  });
  console.log(`Updated Credits: ${userAfter.sisa_credit}`);
  console.log(`Expected Credits: ${userBefore.sisa_credit + pkg.jumlahKoin}`);

  if (userAfter.sisa_credit === userBefore.sisa_credit + pkg.jumlahKoin) {
    console.log("✅ TEST SUCCESSFUL: User package balances and credits updated correctly!");
  } else {
    console.error("❌ TEST FAILED: User credits were not updated correctly.");
  }
}

runTest()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
