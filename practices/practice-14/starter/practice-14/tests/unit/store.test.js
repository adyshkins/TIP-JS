import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresStore } from '../../src/store.js';

function result(rows = [], rowCount = rows.length) {
  return { rows, rowCount };
}

function scriptedPool(responses = []) {
  const calls = [];
  return {
    calls,
    async query(query, values) {
      calls.push(typeof query === 'string' ? { text: query, values } : query);
      const next = responses.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next ?? result();
    },
  };
}

test('createPostgresStore требует объект с query', () => {
  assert.throws(() => createPostgresStore(), /пул/i);
  assert.throws(() => createPostgresStore({}), /пул/i);
});

test('ping и список категорий возвращают строки драйвера', async () => {
  const categories = [{ id: 1, name: 'Учёба' }];
  const pool = scriptedPool([result([{ ok: 1 }]), result(categories)]);
  const store = createPostgresStore(pool);
  assert.equal(await store.ping(), true);
  assert.deepEqual(await store.listCategories(), categories);
  assert.match(pool.calls[1].text, /ORDER BY id/i);
});

test('getTask возвращает строку или null и параметризует id', async () => {
  const task = { id: 4, title: 'X', completed: false, priority: 'high', categoryId: 2 };
  const pool = scriptedPool([result([task]), result([])]);
  const store = createPostgresStore(pool);
  assert.deepEqual(await store.getTask(4), task);
  assert.equal(await store.getTask(999), null);
  assert.deepEqual(pool.calls[0].values, [4]);
  assert.doesNotMatch(pool.calls[0].text, /WHERE id = 4/i);
});

test('createTask оставляет completed базе и возвращает RETURNING', async () => {
  const task = { id: 35, title: 'X', completed: false, priority: 'low', categoryId: 1 };
  const pool = scriptedPool([result([task])]);
  const actual = await createPostgresStore(pool).createTask({
    title: 'X',
    priority: 'low',
    categoryId: 1,
  });
  assert.deepEqual(actual, task);
  assert.deepEqual(pool.calls[0].values, ['X', 'low', 1]);
  assert.match(pool.calls[0].text, /RETURNING/i);
});

test('updateTask и deleteTask обрабатывают отсутствующую строку', async () => {
  const pool = scriptedPool([result([]), result([], 0), result([], 1)]);
  const store = createPostgresStore(pool);
  assert.equal(await store.updateTask(4, { title: 'Новое' }), null);
  assert.equal(await store.deleteTask(4), false);
  assert.equal(await store.deleteTask(7), true);
});

test('reset выполняет COMMIT одним client и освобождает его', async () => {
  const calls = [];
  let releases = 0;
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      return result();
    },
    release() {
      releases += 1;
    },
  };
  const pool = { query: async () => result(), connect: async () => client };
  assert.deepEqual(await createPostgresStore(pool).reset(), { reset: true, total: 12 });
  assert.equal(calls[0].text, 'BEGIN');
  assert.equal(calls.at(-1).text, 'COMMIT');
  assert.ok(calls.some((call) => /INSERT INTO public\.categories/i.test(call.text)));
  assert.ok(calls.some((call) => /INSERT INTO public\.tasks/i.test(call.text)));
  assert.equal(releases, 1);
});

test('reset при ошибке выполняет ROLLBACK, release и пробрасывает исходную ошибку', async () => {
  const calls = [];
  let releases = 0;
  const failure = new Error('seed failed');
  const client = {
    async query(text) {
      calls.push(text);
      if (calls.length === 3) {
        throw failure;
      }
      return result();
    },
    release() {
      releases += 1;
    },
  };
  const pool = { query: async () => result(), connect: async () => client };
  await assert.rejects(() => createPostgresStore(pool).reset(), failure);
  assert.equal(calls[0], 'BEGIN');
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(releases, 1);
});
