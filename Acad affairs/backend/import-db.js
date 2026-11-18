// backend/import-db.js - Import SQL Schema to Supabase / PostgreSQL
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function importToSupabase() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL is not set in .env.');
    console.error('Please add your Supabase connection string to .env:');
    console.error('DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres');
    process.exit(1);
  }

  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Connected to Supabase!');

  const sqlPath = path.join(__dirname, 'supabase_schema.sql');
  console.log('Reading PostgreSQL schema from:', sqlPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing PostgreSQL schema & seed data...');
  await client.query(sql);
  console.log('✅ Supabase PostgreSQL schema and seed data imported successfully!');

  await client.end();
}

importToSupabase().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
