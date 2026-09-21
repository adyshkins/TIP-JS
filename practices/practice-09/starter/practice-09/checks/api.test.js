import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { tasks, categories } from '../src/data.js';

let server, base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
async function request(path, options = {}) {
  const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(3000) });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body, text };
}
function jsonHeaders(response) {
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('cache-control'), 'no-store');
}
function checkError(result, status, code) {
  assert.equal(result.response.status, status);
  jsonHeaders(result.response);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, 'string');
  assert.ok(result.body.error.message.length > 0);
}
test('Health: 200 и согласованный JSON', async () => {
  const r = await request('/api/health');
  assert.equal(r.response.status, 200); jsonHeaders(r.response);
  assert.deepEqual(r.body, { data: { status: 'ok' } });
});
test('Категории: исходные данные и total', async () => {
  const r = await request('/api/categories');
  assert.equal(r.response.status, 200); jsonHeaders(r.response);
  assert.deepEqual(r.body, { data: categories, meta: { total: 3 } });
});
test('Задачи: исходный массив, total и нормализованные filters', async () => {
  const r = await request('/api/tasks');
  assert.equal(r.response.status, 200); jsonHeaders(r.response);
  assert.deepEqual(r.body, { data: tasks, meta: { total: 12, filters: { completed: null, priority: null, categoryId: null, q: '' } } });
});
const selections = [
  ['completed=false', [4, 7, 13, 19, 22, 28, 34]],
  ['completed=true', [1, 10, 16, 25, 31]],
  ['priority=high', [4, 13, 16, 25, 34]],
  ['priority=medium', [1, 10, 19, 28]],
  ['priority=low', [7, 22, 31]],
  ['categoryId=1', [1, 7, 13]],
  ['categoryId=2', [4, 16, 22, 25, 28, 34]],
  ['q=' + encodeURIComponent('  ПРОВЕР  '), [7, 16]],
  ['completed=false&priority=high&categoryId=2', [4, 34]],
  ['categoryId=999', []],
  ['q=not-found-xyz', []],
  ['q=', tasks.map(t => t.id)],
];
for (const [query, ids] of selections) {
  test(`Выборка ${query}`, async () => {
    const r = await request('/api/tasks?' + query);
    assert.equal(r.response.status, 200);
    assert.deepEqual(r.body.data.map(t => t.id), ids);
    assert.equal(r.body.meta.total, ids.length);
  });
}
test('GET одной задачи: id не равен индексу', async () => {
  const r = await request('/api/tasks/4');
  assert.equal(r.response.status, 200); assert.deepEqual(r.body, { data: tasks[1] });
});
for (const raw of ['0', '01', '-1', '4abc', '1.5', '1e2', '9007199254740992', '%ZZ']) {
  test(`Некорректный id ${raw}`, async () => checkError(await request('/api/tasks/' + raw), 400, 'INVALID_ID'));
}
test('Отсутствующий id: 404 TASK_NOT_FOUND с details.id', async () => {
  const r = await request('/api/tasks/2');
  checkError(r, 404, 'TASK_NOT_FOUND'); assert.deepEqual(r.body.error.details, { id: 2 });
});
for (const query of ['completed=0', 'completed=', 'priority=HIGH', 'categoryId=01', 'categoryId=2abc',
  'q=a&q=b', 'priority=low&priority=high', 'categoryId=1&categoryId=2',
  'completed=false&completed=true', 'sort=id', 'q=' + 'x'.repeat(101)]) {
  test(`HTTP INVALID_QUERY ${query.slice(0, 55)}`, async () => checkError(await request('/api/tasks?' + query), 400, 'INVALID_QUERY'));
}
for (const path of ['/api/health', '/api/categories', '/api/tasks', '/api/tasks/4']) {
  test(`HEAD ${path}: статус и заголовки без тела`, async () => {
    const r = await request(path, { method: 'HEAD' });
    assert.equal(r.response.status, 200); jsonHeaders(r.response); assert.equal(r.text, '');
  });
}
test('HEAD отсутствующей задачи: 404 без тела', async () => {
  const r = await request('/api/tasks/2', { method: 'HEAD' });
  assert.equal(r.response.status, 404); assert.equal(r.text, '');
});
test('OPTIONS: 204 без тела и CORS чтения', async () => {
  const r = await request('/api/tasks', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(r.response.status, 204); assert.equal(r.text, '');
  assert.equal(r.response.headers.get('access-control-allow-origin'), '*');
  assert.equal(r.response.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
});
for (const [method, path] of [['POST','/api/tasks'], ['PATCH','/api/tasks/4'], ['DELETE','/api/tasks/4'], ['PUT','/api/categories'], ['POST','/api/health']]) {
  test(`${method} ${path}: 405 и Allow`, async () => {
    const r = await request(path, { method });
    checkError(r, 405, 'METHOD_NOT_ALLOWED');
    assert.equal(r.response.headers.get('allow'), 'GET, HEAD, OPTIONS');
  });
}
for (const path of ['/missing', '/api/missing', '/api/tasks/4/extra']) {
  test(`Неизвестный путь ${path}`, async () => checkError(await request(path), 404, 'ROUTE_NOT_FOUND'));
}
test('Фильтрация и запрещённое удаление не изменяют исходный набор', async () => {
  await request('/api/tasks?completed=false');
  await request('/api/tasks/4', { method: 'DELETE' });
  const r = await request('/api/tasks');
  assert.deepEqual(r.body.data, tasks);
});
test('Неожиданное исключение: 500 без утечки служебного текста', async () => {
  const broken = createApp({ store: { listTasks() { throw new Error('INTERNAL_SECRET'); } } }).listen(0, '127.0.0.1');
  try {
    await once(broken, 'listening');
    const response = await fetch(`http://127.0.0.1:${broken.address().port}/api/tasks`, { signal: AbortSignal.timeout(3000) });
    const body = await response.json();
    assert.equal(response.status, 500); assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.ok(!JSON.stringify(body).includes('INTERNAL_SECRET')); assert.ok(!('stack' in body.error));
  } finally {
    await new Promise((resolve, reject) => broken.close(error => error ? reject(error) : resolve()));
  }
});
