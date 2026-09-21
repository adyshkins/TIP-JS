import assert from 'node:assert/strict';
import test from 'node:test';
import { createPool } from '../src/db.js';
import { createPostgresStore } from '../src/store.js';

const connectionString = process.env.DATABASE_URL?.trim();

test('полный CRUD сохраняется в PostgreSQL', { skip: !connectionString }, async () => {
  const pool = createPool(connectionString);
  const store = createPostgresStore(pool);
  try {
    assert.equal(await store.ping(), true);
    await store.reset();
    assert.equal((await store.listCategories()).length, 3);
    assert.equal((await store.listTasks()).length, 12);

    const created = await store.createTask({
      title: 'Интеграционная проверка',
      priority: 'high',
      categoryId: 2,
    });
    assert.ok(created.id > 34);
    assert.equal(created.completed, false);
    assert.deepEqual(await store.getTask(created.id), created);

    const filtered = await store.listTasks({
      completed: false,
      priority: 'high',
      categoryId: 2,
      q: 'интеграц',
    });
    assert.deepEqual(filtered.map(task => task.id), [created.id]);

    const updated = await store.updateTask(created.id, { completed: true, categoryId: 3 });
    assert.equal(updated.completed, true);
    assert.equal(updated.categoryId, 3);
    assert.equal(updated.title, created.title);

    assert.equal(await store.deleteTask(created.id), true);
    assert.equal(await store.getTask(created.id), null);
    assert.equal(await store.deleteTask(created.id), false);
  } finally {
    try { await store.reset(); } finally { await pool.end(); }
  }
});
