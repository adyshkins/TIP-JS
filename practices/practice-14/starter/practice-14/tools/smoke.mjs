import assert from 'node:assert/strict';

const baseUrl = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5505').replace(/\/$/, '');

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(3000) });
  const body = await response.json();
  return { response, body };
}

const live = await get('/health/live');
assert.equal(live.response.status, 200);
assert.equal(live.body.status, 'ok');

const ready = await get('/health/ready');
assert.equal(ready.response.status, 200);
assert.equal(ready.body.status, 'ready');
assert.equal(typeof ready.body.version, 'string');

const tasks = await get('/api/tasks?limit=1');
assert.equal(tasks.response.status, 200);
assert.ok(Array.isArray(tasks.body.data));

console.log(`Smoke-проверка ${baseUrl} завершена успешно.`);
