import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Testing connection to:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  const res = await pool.query('SELECT current_database() as db, current_user as usr, version() as ver');
  console.log('✅ Connected successfully!');
  console.log('   Database:', res.rows[0].db);
  console.log('   User:', res.rows[0].usr);
  console.log('   Version:', res.rows[0].ver.substring(0, 60));
  await pool.end();
} catch (e) {
  console.error('❌ Connection failed:', e.message);
  await pool.end();
  process.exit(1);
}
