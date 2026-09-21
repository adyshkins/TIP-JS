import { Router } from 'express';
import { ApiError } from './errors.js';
import { jsonBody } from './json-body.js';
import { requireTask } from './task-resource.js';
import { validateTaskInput } from './task-validation.js';
import { parseFilters } from './validation.js';

async function categoryIds(store) {
  return new Set((await store.listCategories()).map(category => category.id));
}

export function createRouter(store, { enableDebugReset = false } = {}) {
  const router = Router({ caseSensitive: true });

  router.get('/health', async (req, res) => {
    if (!(await store.ping())) throw new Error('Некорректный ответ проверки БД.');
    res.json({ data: { status: 'ok', database: 'connected' } });
  });

  router.get('/categories', async (req, res) => {
    const data = await store.listCategories();
    res.json({ data, meta: { total: data.length } });
  });

  router.get('/tasks', async (req, res) => {
    const filters = parseFilters(new URL(req.originalUrl, 'http://localhost').searchParams);
    const data = await store.listTasks(filters);
    res.json({ data, meta: { total: data.length, filters } });
  });

  router.get('/tasks/:id', requireTask(store), (req, res) => res.json({ data: req.task }));

  router.post('/tasks', ...jsonBody, async (req, res) => {
    const value = validateTaskInput(req.body, { categoryIds: await categoryIds(store) });
    const task = await store.createTask(value);
    res.location(`/api/tasks/${task.id}`).status(201).json({ data: task });
  });

  router.patch('/tasks/:id', requireTask(store), ...jsonBody, async (req, res) => {
    const changes = validateTaskInput(req.body, {
      partial: true,
      categoryIds: await categoryIds(store),
    });
    const task = await store.updateTask(req.task.id, changes);
    if (!task) {
      throw new ApiError(404, 'TASK_NOT_FOUND', 'Задача не найдена.', { id: req.task.id });
    }
    res.json({ data: task });
  });

  router.delete('/tasks/:id', requireTask(store), async (req, res) => {
    if (!(await store.deleteTask(req.task.id))) {
      throw new ApiError(404, 'TASK_NOT_FOUND', 'Задача не найдена.', { id: req.task.id });
    }
    res.status(204).end();
  });

  if (enableDebugReset) {
    router.post('/debug/reset', async (req, res) => res.json({ data: await store.reset() }));
  }

  const methods = [
    ['/health', 'GET, HEAD, OPTIONS'],
    ['/categories', 'GET, HEAD, OPTIONS'],
    ['/tasks', 'GET, HEAD, POST, OPTIONS'],
    ['/tasks/:id', 'GET, HEAD, PATCH, DELETE, OPTIONS'],
  ];
  if (enableDebugReset) methods.push(['/debug/reset', 'POST, OPTIONS']);

  for (const [path, allow] of methods) {
    router.all(path, (req, res) => {
      res.set('Allow', allow);
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается.');
    });
  }
  return router;
}
