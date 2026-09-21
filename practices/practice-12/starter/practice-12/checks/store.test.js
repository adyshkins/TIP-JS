import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresStore } from '../src/store.js';

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
      if (next instanceof Error) throw next;
      return next ?? result();
    },
  };
}

test('ping и категории выполняют фиксированные запросы', async () => {
  const rows = [{ id: 1, name: 'Учёба' }];
  const pool = scriptedPool([result([{ ok: 1 }]), result(rows)]);
  const store = createPostgresStore(pool);
  assert.equal(await store.ping(), true);
  assert.deepEqual(await store.listCategories(), rows);
  assert.match(pool.calls[0].text, /SELECT 1 AS ok/i);
  assert.match(pool.calls[1].text, /FROM public\.categories ORDER BY id/i);
});

test('getTask не склеивает id с SQL', async () => {
  const task = { id: 4, title: 'X', completed: false, priority: 'high', categoryId: 2 };
  const pool = scriptedPool([result([task])]);
  const store = createPostgresStore(pool);
  assert.deepEqual(await store.getTask(4), task);
  assert.deepEqual(pool.calls[0].values, [4]);
  assert.match(pool.calls[0].text, /WHERE id = \$1/i);
  assert.doesNotMatch(pool.calls[0].text, /WHERE id = 4/i);
});

test('getTask возвращает null для отсутствующей строки', async () => {
  const pool = scriptedPool([result([])]);
  assert.equal(await createPostgresStore(pool).getTask(999), null);
});

test('createTask использует default completed и RETURNING', async () => {
  const task = { id: 35, title: 'X', completed: false, priority: 'low', categoryId: 1 };
  const pool = scriptedPool([result([task])]);
  const actual = await createPostgresStore(pool).createTask({ title: 'X', priority: 'low', categoryId: 1 });
  assert.deepEqual(actual, task);
  assert.deepEqual(pool.calls[0].values, ['X', 'low', 1]);
  assert.match(pool.calls[0].text, /INSERT INTO public\.tasks\s*\(title, priority, category_id\)/i);
  assert.match(pool.calls[0].text, /VALUES\s*\(\$1, \$2, \$3\)/i);
  assert.match(pool.calls[0].text, /RETURNING/i);
});

test('updateTask и deleteTask учитывают гонку удаления', async () => {
  const pool = scriptedPool([result([]), result([], 0), result([], 1)]);
  const store = createPostgresStore(pool);
  assert.equal(await store.updateTask(4, { title: 'Новое' }), null);
  assert.equal(await store.deleteTask(4), false);
  assert.equal(await store.deleteTask(7), true);
  assert.deepEqual(pool.calls[1].values, [4]);
  assert.match(pool.calls[1].text, /DELETE FROM public\.tasks WHERE id = \$1/i);
});

test('reset выполняет транзакцию одним client и освобождает его', async () => {
  const calls = [];
  let released = false;
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      return result();
    },
    release() { released = true; },
  };
  const pool = { query: async () => result(), connect: async () => client };
  const value = await createPostgresStore(pool).reset();
  assert.deepEqual(value, { reset: true, total: 12 });
  assert.equal(calls[0].text, 'BEGIN');
  assert.equal(calls.at(-1).text, 'COMMIT');
  assert.ok(calls.some(call => /DELETE FROM public\.tasks/i.test(call.text)));
  assert.ok(calls.some(call => /INSERT INTO public\.categories/i.test(call.text)));
  assert.ok(calls.some(call => /INSERT INTO public\.tasks/i.test(call.text)));
  assert.ok(calls.filter(call => /setval/i.test(call.text)).length >= 2);
  assert.equal(released, true);
});

test('reset откатывает ошибку и освобождает client', async () => {
  const calls = [];
  let released = false;
  const failure = new Error('seed failed');
  const client = {
    async query(text) {
      calls.push(text);
      if (calls.length === 3) throw failure;
      return result();
    },
    release() { released = true; },
  };
  const pool = { query: async () => result(), connect: async () => client };
  await assert.rejects(() => createPostgresStore(pool).reset(), failure);
  assert.equal(calls[0], 'BEGIN');
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(released, true);
});
