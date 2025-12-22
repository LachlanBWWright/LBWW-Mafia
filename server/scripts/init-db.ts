import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Initializing database...");

  try {
    // Verify database connection
    await prisma.$executeRaw`SELECT 1`;
    console.log("✅ Database connection successful");

    // Optional: Seed initial data if needed
    console.log("✅ Database initialization complete");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("✨ Database ready");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
