import { buildListTasksQuery, buildUpdateTaskQuery, taskColumns } from './query-builders.js';

const noFilters = { completed: null, priority: null, categoryId: null, q: '' };

export function createPostgresStore(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('Требуется пул PostgreSQL.');
  }

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
      const result = await pool.query(`SELECT ${taskColumns} FROM public.tasks WHERE id = $1`, [
        id,
      ]);
      return result.rows[0] ?? null;
    },

    async createTask(value) {
      const result = await pool.query(
        `INSERT INTO public.tasks (title, priority, category_id) VALUES ($1, $2, $3) RETURNING ${taskColumns}`,
        [value.title, value.priority, value.categoryId],
      );
      return result.rows[0];
    },

    async updateTask(id, changes) {
      const result = await pool.query(buildUpdateTaskQuery(id, changes));
      return result.rows[0] ?? null;
    },

    async deleteTask(id) {
      const result = await pool.query('DELETE FROM public.tasks WHERE id = $1', [id]);
      return result.rowCount === 1;
    },

    async reset() {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM public.tasks');
        await client.query('DELETE FROM public.categories');
        await client.query(
          `INSERT INTO public.categories (id, name) VALUES ($1,$2),($3,$4),($5,$6)`,
          [1, 'Учёба', 2, 'Проект', 3, 'Организация'],
        );
        await client.query(
          `INSERT INTO public.tasks (id,title,completed,priority,category_id) VALUES
           ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),($11,$12,$13,$14,$15),
           ($16,$17,$18,$19,$20),($21,$22,$23,$24,$25),($26,$27,$28,$29,$30),
           ($31,$32,$33,$34,$35),($36,$37,$38,$39,$40),($41,$42,$43,$44,$45),
           ($46,$47,$48,$49,$50),($51,$52,$53,$54,$55),($56,$57,$58,$59,$60)`,
          [
            1,
            'Изучить функции',
            true,
            'medium',
            1,
            4,
            'Подготовить модель задач',
            false,
            'high',
            2,
            7,
            'Проверить методы массивов',
            false,
            'low',
            1,
            10,
            'Оформить README',
            true,
            'medium',
            3,
            13,
            'Разобрать Promise',
            false,
            'high',
            1,
            16,
            'Проверить учебный API',
            true,
            'high',
            2,
            19,
            'Описать контракт запросов',
            false,
            'medium',
            3,
            22,
            'Подготовить демонстрацию',
            false,
            'low',
            2,
            25,
            'Исправить обработку ошибок',
            true,
            'high',
            2,
            28,
            'Добавить фильтры API',
            false,
            'medium',
            2,
            31,
            'Сверить отчёт',
            true,
            'low',
            3,
            34,
            'Провести рефакторинг клиента',
            false,
            'high',
            2,
          ],
        );
        await client.query(
          `SELECT setval(pg_get_serial_sequence('public.categories','id'), (SELECT max(id) FROM public.categories), true)`,
        );
        await client.query(
          `SELECT setval(pg_get_serial_sequence('public.tasks','id'), (SELECT max(id) FROM public.tasks), true)`,
        );
        await client.query('COMMIT');
        return { reset: true, total: 12 };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
