import assert from 'node:assert/strict';
import test from 'node:test';
import { createPool } from '../../src/db.js';
import { createPostgresStore } from '../../src/store.js';

test('CRUD работает на отдельной учебной базе PostgreSQL', async () => {
  const connectionString = process.env.DATABASE_URL?.trim();
  assert.ok(connectionString, 'Для test:db требуется локальный DATABASE_URL.');

  const pool = createPool(connectionString);
  const store = createPostgresStore(pool);
  try {
    assert.equal(await store.ping(), true);
    await store.reset();
    assert.equal((await store.listTasks()).length, 12);

    const created = await store.createTask({
      title: 'Проверка качества',
      priority: 'high',
      categoryId: 2,
    });
    assert.ok(created.id > 34);
    assert.deepEqual(await store.getTask(created.id), created);

    const updated = await store.updateTask(created.id, { completed: true });
    assert.equal(updated.completed, true);
    assert.equal(await store.deleteTask(created.id), true);
    assert.equal(await store.getTask(created.id), null);
  } finally {
    try {
      await store.reset();
    } finally {
      await pool.end();
    }
  }
});
