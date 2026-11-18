// backend/db.js - PostgreSQL / Supabase Connection
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

let connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

let pool = createPool(connectionString);

function createPool(connStr) {
  const config = connStr
    ? {
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      }
    : {
        host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
        port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      };

  const newPool = new Pool(config);
  newPool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err.message);
  });
  return newPool;
}

/**
 * Replaces the active pool with a new connection string
 */
export async function updateConnection(newConnStr) {
  const testPool = new Pool({
    connectionString: newConnStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  // Verify connection
  await testPool.query('SELECT 1');

  // Replace active pool
  const oldPool = pool;
  pool = testPool;
  pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err.message);
  });
  oldPool.end().catch(() => {});

  // Update .env files
  connectionString = newConnStr;
  process.env.DATABASE_URL = newConnStr;

  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('DATABASE_URL=')) {
        content = content.replace(/DATABASE_URL=.*/, `DATABASE_URL=${newConnStr}`);
      } else {
        content += `\nDATABASE_URL=${newConnStr}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
  }

  // Check if tables exist, if not, auto-import schema
  try {
    const tableCheck = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );
    if (tableCheck.rows.length === 0) {
      console.log('Tables do not exist yet. Running supabase_schema.sql...');
      const schemaPath = path.join(__dirname, 'supabase_schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(sql);
        console.log('✅ Supabase PostgreSQL schema and seed data loaded automatically!');
      }
    }
  } catch (schemaErr) {
    console.warn('Auto-schema check error:', schemaErr.message);
  }

  return true;
}

/**
 * Executes SQL query, converting MySQL-style '?' parameter placeholders to PostgreSQL '$1, $2...'
 */
export const query = async (sql, params = []) => {
  let paramIndex = 1;
  const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  const result = await pool.query(pgSql, params);
  return result.rows;
};

export { pool };
