function parsePort(raw) {
  if (!/^\d+$/.test(raw)) throw new Error('API_PORT должен быть целым числом от 1024 до 65535.');
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('API_PORT должен быть целым числом от 1024 до 65535.');
  }
  return port;
}

function parseBoolean(raw, name) {
  if (raw === undefined) return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} должен быть true или false.`);
}

export function readConfig(env = process.env) {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('Не задан DATABASE_URL. Создайте .env по образцу .env.example.');
  return {
    port: parsePort(env.API_PORT ?? '5505'),
    connectionString,
    enableDebugReset: parseBoolean(env.ENABLE_DEBUG_RESET, 'ENABLE_DEBUG_RESET'),
  };
}
