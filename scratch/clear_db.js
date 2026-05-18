require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDatabase() {
  console.log("=== STARTING DATABASE CLEANUP ===");
  
  try {
    // Order is important to avoid foreign key constraint errors
    console.log("Cleaning UserPackageBalance...");
    await prisma.userPackageBalance.deleteMany({});

    console.log("Cleaning SystemApiLog...");
    await prisma.systemApiLog.deleteMany({});

    console.log("Cleaning AIGeneration...");
    await prisma.aIGeneration.deleteMany({});

    console.log("Cleaning Transaction...");
    await prisma.transaction.deleteMany({});

    console.log("Cleaning Feedback...");
    await prisma.feedback.deleteMany({});

    console.log("Cleaning AuditLog...");
    await prisma.auditLog.deleteMany({});

    console.log("Cleaning Notification...");
    await prisma.notification.deleteMany({});

    console.log("Cleaning Waitlist...");
    await prisma.waitlist.deleteMany({});

    console.log("Cleaning SocialMedia...");
    await prisma.socialMedia.deleteMany({});

    console.log("Cleaning Gallery...");
    await prisma.gallery.deleteMany({});

    console.log("Cleaning Barber...");
    await prisma.barber.deleteMany({});

    console.log("Cleaning Service...");
    await prisma.service.deleteMany({});

    console.log("Cleaning AdminTokenPurchase...");
    await prisma.adminTokenPurchase.deleteMany({});

    // User refers to SubscriptionPackage, but SubscriptionPackage also has many Users.
    // We should clear Users first because they are the "Leaves" in most relations.
    console.log("Cleaning User...");
    await prisma.user.deleteMany({});

    console.log("Cleaning SubscriptionPackage...");
    await prisma.subscriptionPackage.deleteMany({});

    console.log("Cleaning AiModel...");
    await prisma.aiModel.deleteMany({});

    console.log("Cleaning CreditPackage...");
    await prisma.creditPackage.deleteMany({});

    console.log("Cleaning FeaturePricing...");
    await prisma.featurePricing.deleteMany({});

    console.log("Cleaning SystemConfig...");
    await prisma.systemConfig.deleteMany({});

    console.log("=== DATABASE CLEANUP COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("!!! FAILED TO CLEAR DATABASE !!!");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
