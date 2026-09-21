import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('Для подготовки базы требуется DATABASE_URL.');
}

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });

try {
  const schema = await readFile(new URL('../sql/01_schema.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('../sql/02_seed.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  await pool.query(seed);
  console.log('Схема и исходные данные PostgreSQL подготовлены.');
} finally {
  await pool.end();
}
