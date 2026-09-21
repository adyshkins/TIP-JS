import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStore } from '../src/store.js';
import { fixture } from './support/http.js';
const valid = { title: 'Проверить новый сервер', priority: 'high', categoryId: 2 };
function error(r, status, code) {
  assert.equal(r.status, status); assert.equal(r.body.error.code, code);
  assert.equal(typeof r.body.error.message, 'string'); assert.ok(r.body.error.message);
  assert.match(r.headers.get('content-type'), /^application\/json/);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
}
test('POST: 201, Location, серверный id и GET новой записи', async t => {
  const { request } = await fixture(t);
  const r = await request('/tasks', { method: 'POST', value: { ...valid, title: '  ' + valid.title + '  ' } });
  assert.equal(r.status, 201); assert.equal(r.headers.get('location'), '/api/tasks/35');
  assert.equal(r.headers.get('access-control-expose-headers'), 'Location');
  assert.deepEqual(r.body.data, { id: 35, ...valid, completed: false });
  assert.deepEqual((await request('/tasks/35')).body, r.body);
  assert.equal((await request('/tasks')).body.meta.total, 13);
});
test('PATCH сохраняет completed:true при редактировании формы', async t => {
  const { request } = await fixture(t);
  const r = await request('/tasks/1', { method: 'PATCH', value: valid });
  assert.equal(r.status, 200); assert.deepEqual(r.body.data, { id: 1, ...valid, completed: true });
});
test('PATCH completed:false не сбрасывает поля; фильтр отражает изменение', async t => {
  const { request } = await fixture(t);
  const before = (await request('/tasks/1')).body.data;
  const r = await request('/tasks/1', { method: 'PATCH', value: { completed: false } });
  assert.equal(r.status, 200); assert.deepEqual(r.body.data, { ...before, completed: false });
  assert.ok((await request('/tasks?completed=false')).body.data.some(task => task.id === 1));
});
test('DELETE: 204 без тела, затем GET/DELETE 404', async t => {
  const { request } = await fixture(t);
  const r = await request('/tasks/4', { method: 'DELETE' });
  assert.equal(r.status, 204); assert.equal(r.text, ''); assert.equal(r.headers.get('content-type'), null);
  error(await request('/tasks/4'), 404, 'TASK_NOT_FOUND');
  error(await request('/tasks/4', { method: 'DELETE' }), 404, 'TASK_NOT_FOUND');
  assert.equal((await request('/tasks')).body.meta.total, 11);
});
test('Два POST и удаление: последовательные id без повторного использования', async t => {
  const { request } = await fixture(t);
  const a = await request('/tasks', { method: 'POST', value: valid });
  assert.equal(a.status, 201); await request('/tasks/' + a.body.data.id, { method: 'DELETE' });
  const b = await request('/tasks', { method: 'POST', value: valid });
  assert.equal(b.status, 201); assert.equal(b.body.data.id, a.body.data.id + 1);
});
const bad = [
  ['пустое название', { ...valid, title: ' ' }, 'title'],
  ['длинное название', { ...valid, title: 'я'.repeat(101) }, 'title'],
  ['неизвестная категория', { ...valid, categoryId: 999 }, 'categoryId'],
  ['строковая категория', { ...valid, categoryId: '2' }, 'categoryId'],
  ['приоритет', { ...valid, priority: 'HIGH' }, 'priority'],
  ['id', { ...valid, id: 999 }, 'id'],
  ['completed', { ...valid, completed: false }, 'completed'],
  ['лишнее поле', { ...valid, extra: true }, 'extra'],
  ['не объект', null, 'body'],
  ['массив', [], 'body'],
  ['число', 42, 'body'],
];
for (const [name, value, key] of bad) {
  test(`POST валидация: ${name}; данные и nextId не изменены`, async t => {
    const { request } = await fixture(t);
    const before = (await request('/tasks')).body;
    const r = await request('/tasks', { method: 'POST', value });
    error(r, 400, 'VALIDATION_ERROR'); assert.ok(Object.hasOwn(r.body.error.details, key));
    assert.deepEqual((await request('/tasks')).body, before);
    const created = await request('/tasks', { method: 'POST', value: valid });
    assert.equal(created.status, 201); assert.equal(created.body.data.id, 35);
  });
}
for (const value of [{}, { completed: 'false' }, { id: 8 }, { title: 'Новое', categoryId: 999 }]) {
  test(`PATCH отклоняет всё изменение: ${JSON.stringify(value)}`, async t => {
    const { request } = await fixture(t); const before = (await request('/tasks/4')).body;
    error(await request('/tasks/4', { method: 'PATCH', value }), 400, 'VALIDATION_ERROR');
    assert.deepEqual((await request('/tasks/4')).body, before);
  });
}
for (const [name, options, status, code] of [
  ['сломанный JSON', { raw: '{"title":', headers: { 'Content-Type': 'application/json' } }, 400, 'INVALID_JSON'],
  ['пустое тело', { raw: '', headers: { 'Content-Type': 'application/json' } }, 400, 'INVALID_JSON'],
  ['нет Content-Type', {}, 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ['text/plain', { raw: JSON.stringify(valid), headers: { 'Content-Type': 'text/plain' } }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ['слишком большой JSON', { value: { ...valid, title: 'x'.repeat(17000) } }, 413, 'PAYLOAD_TOO_LARGE'],
  ['неподдерживаемая кодировка', { raw: '{}', headers: { 'Content-Type': 'application/json; charset=windows-1251' } }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
]) {
  test(`Разбор тела: ${name}`, async t => {
    const { request } = await fixture(t); const before = (await request('/tasks')).body;
    error(await request('/tasks', { method: 'POST', ...options }), status, code);
    assert.deepEqual((await request('/tasks')).body, before);
  });
}
test('PATCH проверяет id до разбора тела', async t => {
  const { request } = await fixture(t);
  error(await request('/tasks/4abc', { method: 'PATCH' }), 400, 'INVALID_ID');
  error(await request('/tasks/2', { method: 'PATCH' }), 404, 'TASK_NOT_FOUND');
});
test('DELETE проверяет некорректный id', async t => {
  const { request } = await fixture(t);
  error(await request('/tasks/0', { method: 'DELETE' }), 400, 'INVALID_ID');
});
test('UTF-8 Content-Type с charset и название длиной 100', async t => {
  const { request } = await fixture(t);
  const r = await request('/tasks', { method: 'POST', value: { ...valid, title: 'я'.repeat(100) }, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  assert.equal(r.status, 201); assert.equal(r.body.data.title.length, 100);
});
test('Специальное имя __proto__ отклоняется с details', async t => {
  const { request } = await fixture(t);
  const r = await request('/tasks', { method: 'POST', raw: '{"title":"X","priority":"high","categoryId":2,"__proto__":{"polluted":true}}', headers: { 'Content-Type': 'application/json' } });
  error(r, 400, 'VALIDATION_ERROR'); assert.ok(Object.hasOwn(r.body.error.details, '__proto__'));
});
test('Учебный reset восстанавливает данные и счётчик', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/tasks', { method: 'POST', value: valid })).status, 201);
  const r = await request('/debug/reset', { method: 'POST' });
  assert.equal(r.status, 200); assert.deepEqual(r.body, { data: { reset: true, total: 12 } });
  assert.equal((await request('/tasks', { method: 'POST', value: valid })).body.data.id, 35);
});
test('Preflight PATCH: методы, Content-Type и отсутствие тела', async t => {
  const { request } = await fixture(t);
  const r = await request('/tasks/4', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(r.status, 204); assert.equal(r.text, '');
  assert.ok(r.headers.get('access-control-allow-methods').includes('PATCH'));
  assert.ok(r.headers.get('access-control-allow-headers').includes('Content-Type'));
});
test('Параллельные POST: уникальные id и все записи доступны', async t => {
  const { request } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 5 }, (_, i) => request('/tasks', { method: 'POST', value: { ...valid, title: 'Параллельная ' + i } })));
  results.forEach(r => assert.equal(r.status, 201));
  assert.equal(new Set(results.map(r => r.body.data.id)).size, 5);
  assert.equal((await request('/tasks')).body.meta.total, 17);
});

test('Задача удалена во время получения тела PATCH: 404 без восстановления записи', async t => {
  const real = createStore(); let notify;
  const checked = new Promise(resolve => { notify = resolve; });
  const store = { ...real, getTask(id) { const task = real.getTask(id); notify(); return task; } };
  const { base, request } = await fixture(t, { store });
  const body = JSON.stringify({ title: 'Запоздалое изменение' });
  const req = http.request(base + '/tasks/4', { method: 'PATCH', headers: {
    'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
  } });
  t.after(() => req.destroy());
  const result = new Promise((resolve, reject) => {
    req.on('error', reject);
    req.on('response', res => {
      let text = ''; res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(text) }); } catch (e) { reject(e); } });
    });
  });
  // Обработчик ошибки подключён до ожидания другой операции.
  void result.catch(() => {});
  req.setTimeout(3000, () => req.destroy(new Error('PATCH timeout')));
  req.write(body.slice(0, 1));
  await checked; // requireTask уже прочитал запись, parser ещё ждёт тело.
  assert.equal((await request('/tasks/4', { method: 'DELETE' })).status, 204);
  req.end(body.slice(1));
  const r = await result;
  assert.equal(r.status, 404); assert.equal(r.body.error.code, 'TASK_NOT_FOUND');
  assert.equal((await request('/tasks/4')).status, 404);
});
