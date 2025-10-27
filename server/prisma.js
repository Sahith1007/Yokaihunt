// PrismaClient singleton helper
const { PrismaClient } = require("@prisma/client");

const globalForPrisma = global;

const prisma = globalForPrisma.__prisma || new PrismaClient();
if (!globalForPrisma.__prisma) globalForPrisma.__prisma = prisma;

module.exports = { prisma };
