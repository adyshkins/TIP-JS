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

test('POST отклоняет неверный media type, пустой и сломанный JSON', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const media = await request(origin, '/api/tasks', { method: 'POST', body: '{}' });
    assert.equal(media.response.status, 415);
    const empty = await request(origin, '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    assert.equal(empty.response.status, 400);
    assert.equal(empty.body.error.code, 'INVALID_JSON');
    const broken = await request(origin, '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(broken.response.status, 400);
    assert.equal(broken.body.error.code, 'INVALID_JSON');
  });
});

test('валидация отклоняет неизвестное поле и несуществующую категорию без изменения данных', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    for (const value of [
      { title: 'X', priority: 'low', categoryId: 999 },
      { title: 'X', priority: 'low', categoryId: 1, role: 'admin' },
    ]) {
      const answer = await request(origin, '/api/tasks', json(value));
      assert.equal(answer.response.status, 400);
      assert.equal(answer.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal((await request(origin, '/api/tasks')).body.meta.total, 3);
  });
});

test('405 содержит Allow, а OPTIONS возвращает CORS-заголовки', async () => {
  await withApi({ store: createFakeStore() }, async (origin) => {
    const put = await request(origin, '/api/tasks/4', { method: 'PUT' });
    assert.equal(put.response.status, 405);
    assert.equal(put.response.headers.get('allow'), 'GET, HEAD, PATCH, DELETE, OPTIONS');
    const options = await request(origin, '/api/tasks/4', { method: 'OPTIONS' });
    assert.equal(options.response.status, 204);
    assert.match(options.response.headers.get('access-control-allow-methods'), /PATCH/);
  });
});

test('SQLSTATE внешнего ключа и соединения переводятся в безопасные ошибки API', async () => {
  const base = createFakeStore();
  await withApi(
    {
      store: {
        ...base,
        async createTask() {
          throw Object.assign(new Error('database detail'), { code: '23503' });
        },
      },
    },
    async (origin) => {
      const answer = await request(
        origin,
        '/api/tasks',
        json({ title: 'X', priority: 'low', categoryId: 1 }),
      );
      assert.equal(answer.response.status, 400);
      assert.equal(answer.body.error.code, 'VALIDATION_ERROR');
      assert.doesNotMatch(JSON.stringify(answer.body), /database detail|23503/);
    },
  );
  await withApi(
    {
      store: {
        ...base,
        async ping() {
          throw Object.assign(new Error('socket detail'), { code: '08006' });
        },
      },
    },
    async (origin) => {
      const answer = await request(origin, '/api/health');
      assert.equal(answer.response.status, 503);
      assert.equal(answer.body.error.code, 'DATABASE_UNAVAILABLE');
      assert.doesNotMatch(JSON.stringify(answer.body), /socket detail|08006/);
    },
  );
});

test('гонка удаления между requireTask и PATCH возвращает 404', async () => {
  const base = createFakeStore();
  const store = {
    ...base,
    async updateTask() {
      return null;
    },
  };
  await withApi({ store }, async (origin) => {
    const answer = await request(origin, '/api/tasks/4', json({ completed: true }, 'PATCH'));
    assert.equal(answer.response.status, 404);
    assert.equal(answer.body.error.code, 'TASK_NOT_FOUND');
    assert.deepEqual(answer.body.error.details, { id: 4 });
  });
});
