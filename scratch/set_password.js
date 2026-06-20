const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function run() {
  const email = "dinarmuhammadakbar04@gmail.com";
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      otp: null,
      otpExpires: null
    }
  });
  console.log("Password updated for user:", updatedUser.email);
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
