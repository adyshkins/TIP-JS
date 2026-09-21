import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { createFakeStore } from '../support/fake-store.js';
import { request, startServer } from '../support/http.js';

async function withApi(options, run) {
  const running = await startServer(createApp(options));
  try {
    await run(running.origin);
  } finally {
    await running.close();
  }
}

function json(value, method = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

test('health подтверждает БД и не раскрывает Express', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const { response, body } = await request(origin, '/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: { status: 'ok', database: 'connected' } });
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('GET списка применяет четыре фильтра', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const answer = await request(
      origin,
      '/api/tasks?completed=false&priority=high&categoryId=2&q=%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C',
    );
    assert.equal(answer.response.status, 200);
    assert.deepEqual(
      answer.body.data.map((task) => task.id),
      [4],
    );
    assert.equal(answer.body.meta.total, 1);
  });
});

test('GET по id различает неверный, отсутствующий и существующий id', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    assert.equal((await request(origin, '/api/tasks/0')).response.status, 400);
    assert.equal((await request(origin, '/api/tasks/999')).response.status, 404);
    const found = await request(origin, '/api/tasks/4');
    assert.equal(found.response.status, 200);
    assert.equal(found.body.data.title, 'Подготовить модель задач');
  });
});

test('POST → PATCH → DELETE сохраняет контракт', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const created = await request(
      origin,
      '/api/tasks',
      json({ title: '  Проверить тесты  ', priority: 'high', categoryId: 2 }),
    );
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.title, 'Проверить тесты');
    assert.equal(created.response.headers.get('location'), `/api/tasks/${created.body.data.id}`);

    const updated = await request(
      origin,
      `/api/tasks/${created.body.data.id}`,
      json({ completed: true }, 'PATCH'),
    );
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.completed, true);
    assert.equal(updated.body.data.title, 'Проверить тесты');

    const deleted = await request(origin, `/api/tasks/${created.body.data.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleted.response.status, 204);
    assert.equal(deleted.body, null);
  });
});

test('debug reset доступен только при явном включении', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    assert.equal(
      (await request(origin, '/api/debug/reset', { method: 'POST' })).response.status,
      404,
    );
  });
  await withApi({ store: createFakeStore(), enableDebugReset: true }, async (origin) => {
    const answer = await request(origin, '/api/debug/reset', { method: 'POST' });
    assert.equal(answer.response.status, 200);
    assert.deepEqual(answer.body, { data: { reset: true, total: 3 } });
  });
});

test.todo('POST отклоняет неверный media type, пустой и сломанный JSON');
test.todo('валидация отклоняет неизвестное поле и несуществующую категорию без изменения данных');
test.todo('405 содержит Allow, а OPTIONS возвращает CORS-заголовки');
test.todo('SQLSTATE внешнего ключа и соединения переводятся в безопасные ошибки API');
test.todo('гонка удаления между requireTask и PATCH возвращает 404');
