import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000001";

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: "demo@nono.local",
    },
    update: {
      name: "테스트 사용자",
    },
    create: {
      name: "테스트 사용자",
      email: "demo@nono.local",
      emailVerified: true,
    },
  });

  const project = await prisma.project.upsert({
    where: {
      id: DEMO_PROJECT_ID,
    },
    update: {
      title: "테스트 프로젝트",
      ownerId: user.id,
    },
    create: {
      id: DEMO_PROJECT_ID,
      title: "테스트 프로젝트",
      ownerId: user.id,
    },
  });

  console.log({
    user,
    project,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
