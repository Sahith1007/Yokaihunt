// PrismaClient singleton helper
// Tries custom output first (as set in prisma/schema.prisma), then falls back to @prisma/client
let PrismaClient;
try {
  // eslint-disable-next-line import/no-unresolved, global-require
  ({ PrismaClient } = require("../app/generated/prisma"));
} catch (e) {
  // eslint-disable-next-line global-require
  ({ PrismaClient } = require("@prisma/client"));
}

const globalForPrisma = global;

const prisma = globalForPrisma.__prisma || new PrismaClient();
if (!globalForPrisma.__prisma) globalForPrisma.__prisma = prisma;

module.exports = { prisma };
