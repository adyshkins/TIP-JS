import { createPool } from '../src/db.js';
import { createPostgresStore } from '../src/store.js';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('Не задан DATABASE_URL.');

const pool = createPool(connectionString);
const store = createPostgresStore(pool);

try {
  const categories = await store.listCategories();
  const created = await store.createTask({
    title: 'Проверить постоянное хранение',
    priority: 'medium',
    categoryId: categories[0].id,
  });
  console.log('Создано:', created);
  console.log('Повторное чтение:', await store.getTask(created.id));
  console.log('Запустите пример ещё раз: прежняя запись останется в PostgreSQL.');
} finally {
  await pool.end();
}
