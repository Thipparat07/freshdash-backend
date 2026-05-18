const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  // Strip out sslmode=require to prevent pg-connection-string from forcing verify-full
  connectionString = connectionString.replace('?sslmode=require', '').replace('&sslmode=require', '');
}

const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

module.exports = { prisma };
