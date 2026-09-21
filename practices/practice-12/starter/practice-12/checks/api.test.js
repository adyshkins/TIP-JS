import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createFakeStore } from './support/fake-store.js';
import { request, startServer } from './support/http.js';

async function withApi(options, run) {
  const running = await startServer(createApp(options));
  try {
    await run(running.origin);
  } finally {
    await running.close();
  }
}

const json = value => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value),
});

test('health подтверждает соединение с БД', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const { response, body } = await request(origin, '/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: { status: 'ok', database: 'connected' } });
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('список, фильтры и категории сохраняют контракт ПР10', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const tasks = await request(origin, '/api/tasks?completed=false&priority=high&categoryId=2&q=%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C');
    assert.equal(tasks.response.status, 200);
    assert.deepEqual(tasks.body.data.map(item => item.id), [4]);
    assert.equal(tasks.body.meta.total, 1);
    assert.deepEqual(tasks.body.meta.filters, {
      completed: false,
      priority: 'high',
      categoryId: 2,
      q: 'модель',
    });
    const categories = await request(origin, '/api/categories');
    assert.equal(categories.body.meta.total, 3);
    assert.deepEqual(categories.body.data.map(item => item.name), ['Учёба', 'Проект', 'Организация']);
  });
});

test('GET по id различает неверный, отсутствующий и существующий id', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const invalid = await request(origin, '/api/tasks/0');
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.error.code, 'INVALID_ID');
    const missing = await request(origin, '/api/tasks/999');
    assert.equal(missing.response.status, 404);
    assert.deepEqual(missing.body.error.details, { id: 999 });
    const found = await request(origin, '/api/tasks/4');
    assert.equal(found.response.status, 200);
    assert.equal(found.body.data.title, 'Подготовить модель задач');
  });
});

test('POST создаёт задачу и возвращает Location', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const created = await request(origin, '/api/tasks', json({
      title: '  Сохранить в PostgreSQL  ',
      priority: 'high',
      categoryId: 2,
    }));
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.title, 'Сохранить в PostgreSQL');
    assert.equal(created.body.data.completed, false);
    assert.equal(created.response.headers.get('location'), `/api/tasks/${created.body.data.id}`);
    const found = await request(origin, `/api/tasks/${created.body.data.id}`);
    assert.deepEqual(found.body.data, created.body.data);
  });
});

test('PATCH изменяет только переданные поля, включая false', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const updated = await request(origin, '/api/tasks/1', {
      ...json({ title: 'Новое название', completed: false }),
      method: 'PATCH',
    });
    assert.equal(updated.response.status, 200);
    assert.deepEqual(updated.body.data, {
      id: 1,
      title: 'Новое название',
      completed: false,
      priority: 'medium',
      categoryId: 1,
    });
  });
});

test('DELETE возвращает 204 без JSON', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const deleted = await request(origin, '/api/tasks/7', { method: 'DELETE' });
    assert.equal(deleted.response.status, 204);
    assert.equal(deleted.body, null);
    assert.equal((await request(origin, '/api/tasks/7')).response.status, 404);
  });
});

test('валидация отклоняет неверный тип, категорию и неизвестное поле', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    for (const value of [
      { title: 'X', priority: 'high', categoryId: '2' },
      { title: 'X', priority: 'high', categoryId: 999 },
      { title: 'X', priority: 'high', categoryId: 2, role: 'admin' },
      { title: '   ', priority: 'high', categoryId: 2 },
    ]) {
      const answer = await request(origin, '/api/tasks', json(value));
      assert.equal(answer.response.status, 400);
      assert.equal(answer.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal((await request(origin, '/api/tasks')).body.meta.total, 3);
  });
});

test('парсер различает media type, пустое тело и сломанный JSON', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const media = await request(origin, '/api/tasks', { method: 'POST', body: '{}' });
    assert.equal(media.response.status, 415);
    const empty = await request(origin, '/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '',
    });
    assert.equal(empty.response.status, 400);
    assert.equal(empty.body.error.code, 'INVALID_JSON');
    const broken = await request(origin, '/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(broken.response.status, 400);
    assert.equal(broken.body.error.code, 'INVALID_JSON');
  });
});

test('неподдерживаемый метод сообщает Allow, OPTIONS использует CORS', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    const put = await request(origin, '/api/tasks/4', { method: 'PUT' });
    assert.equal(put.response.status, 405);
    assert.equal(put.response.headers.get('allow'), 'GET, HEAD, PATCH, DELETE, OPTIONS');
    const options = await request(origin, '/api/tasks/4', { method: 'OPTIONS' });
    assert.equal(options.response.status, 204);
    assert.match(options.response.headers.get('access-control-allow-methods'), /PATCH/);
  });
});

test('debug reset выключен по умолчанию и включается явно', async () => {
  await withApi({ store: createFakeStore() }, async origin => {
    assert.equal((await request(origin, '/api/debug/reset', { method: 'POST' })).response.status, 404);
  });
  await withApi({ store: createFakeStore(), enableDebugReset: true }, async origin => {
    const answer = await request(origin, '/api/debug/reset', { method: 'POST' });
    assert.equal(answer.response.status, 200);
    assert.deepEqual(answer.body, { data: { reset: true, total: 3 } });
  });
});

test('коды PostgreSQL переводятся в безопасные ошибки API', async () => {
  const base = createFakeStore();
  await withApi({ store: { ...base, async createTask() { throw Object.assign(new Error('detail'), { code: '23503' }); } } }, async origin => {
    const answer = await request(origin, '/api/tasks', json({ title: 'X', priority: 'low', categoryId: 1 }));
    assert.equal(answer.response.status, 400);
    assert.equal(answer.body.error.code, 'VALIDATION_ERROR');
    assert.doesNotMatch(JSON.stringify(answer.body), /"detail":"|23503/);
  });
  await withApi({ store: { ...base, async ping() { throw Object.assign(new Error('socket'), { code: '08006' }); } } }, async origin => {
    const answer = await request(origin, '/api/health');
    assert.equal(answer.response.status, 503);
    assert.equal(answer.body.error.code, 'DATABASE_UNAVAILABLE');
  });
});
