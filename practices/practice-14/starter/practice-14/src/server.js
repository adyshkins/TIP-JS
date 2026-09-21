import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createPool } from './db.js';
import { createPostgresStore } from './store.js';

let pool;
let server;

async function shutdown(signal) {
  console.log(`\nПолучен ${signal}. Завершение работы...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (pool) {
    await pool.end();
  }
}

try {
  const config = readConfig();
  pool = createPool(config.connectionString);
  const store = createPostgresStore(pool);
  await store.ping();
  server = createApp({ store, enableDebugReset: config.enableDebugReset }).listen(
    config.port,
    '127.0.0.1',
    () => {
      console.log(`API ПР12: http://127.0.0.1:${config.port}/api`);
      console.log('Хранилище: PostgreSQL. Остановка: Ctrl+C.');
    },
  );
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? `Порт ${config.port} занят.` : error.message);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => shutdown(signal).then(() => process.exit(0)));
  }
} catch (error) {
  console.error(`API не запущен: ${error.message}`);
  if (pool) {
    await pool.end().catch(() => {});
  }
  process.exitCode = 1;
}
