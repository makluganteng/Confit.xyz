import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://confit:confit@localhost:5432/confit";

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
