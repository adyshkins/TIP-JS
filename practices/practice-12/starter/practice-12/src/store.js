import { notImplemented } from './errors.js';
import { buildListTasksQuery, buildUpdateTaskQuery, taskColumns } from './query-builders.js';

const noFilters = { completed: null, priority: null, categoryId: null, q: '' };

export function createPostgresStore(pool) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('Требуется пул PostgreSQL.');

  return {
    async ping() {
      const result = await pool.query('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    },

    async listCategories() {
      const result = await pool.query('SELECT id, name FROM public.categories ORDER BY id');
      return result.rows;
    },

    async listTasks(filters = noFilters) {
      const query = buildListTasksQuery(filters);
      const result = await pool.query(query);
      return result.rows;
    },

    async getTask(id) {
      // TODO: параметризованный SELECT по id; вернуть строку или null.
      // Использовать taskColumns и не подставлять id в SQL-строку.
      return notImplemented('store.getTask');
    },

    async createTask(value) {
      // TODO: INSERT title, priority, category_id; completed назначает БД.
      // Использовать $1–$3 и RETURNING taskColumns. Вернуть созданную строку.
      return notImplemented('store.createTask');
    },

    async updateTask(id, changes) {
      // TODO: выполнить buildUpdateTaskQuery(id, changes), вернуть строку
      // RETURNING либо null, если запись уже удалена.
      return notImplemented('store.updateTask');
    },

    async deleteTask(id) {
      // TODO: DELETE ... WHERE id = $1; вернуть result.rowCount === 1.
      return notImplemented('store.deleteTask');
    },

    async reset() {
      // TODO: получить ОДИН client через pool.connect(). На нём выполнить
      // BEGIN; DELETE tasks; DELETE categories; загрузить исходные категории
      // и 12 задач из sql/02_seed.sql; синхронизировать обе sequence; COMMIT.
      // При любой ошибке выполнить ROLLBACK и пробросить ошибку, а в finally
      // всегда вызвать client.release(). Вернуть { reset: true, total: 12 }.
      return notImplemented('store.reset');
    },
  };
}
