import { Pool } from 'pg';

export function createPool(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  pool.on('error', (error) =>
    console.error('Ошибка простаивающего подключения PostgreSQL:', error.message),
  );
  return pool;
}
