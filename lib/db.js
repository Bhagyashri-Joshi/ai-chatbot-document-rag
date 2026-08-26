// lib/db.js
// Responsible for: Prisma client / database connection.
//
// Uses the standard Next.js "singleton in dev" pattern so that hot-reloading
// in development doesn't exhaust the Postgres connection pool by creating a
// new PrismaClient on every file change.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
