import { once } from 'node:events';
import { createApp } from '../../src/app.js';
export async function fixture(t, options) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { method = 'GET', value, raw, headers = {} } = {}) => {
    const body = raw !== undefined ? raw : value === undefined ? undefined : JSON.stringify(value);
    const response = await fetch(base + path, {
      method, headers: { ...(value !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body, signal: AbortSignal.timeout(3000),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, body: text ? JSON.parse(text) : null };
  };
  return { base, request };
}
