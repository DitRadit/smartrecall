/**
 * db.js - Prisma Client singleton.
 *
 * Database utama (source of truth) adalah SQLite via Prisma, sesuai
 * ARCHITECTURE.md prinsip #3: localStorage/IndexedDB di frontend hanya cache.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
