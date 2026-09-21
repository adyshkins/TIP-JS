import { Router } from 'express';
import { ApiError } from './errors.js';
import { parseFilters } from './validation.js';
import { requireTask } from './task-resource.js';
import { registerWriteRoutes } from './write-routes.js';
export function createRouter(store) {
  const router = Router({ caseSensitive: true });
  router.get('/health', (req, res) => res.json({ data: { status: 'ok' } }));
  router.get('/categories', (req, res) => {
    const data = store.listCategories(); res.json({ data, meta: { total: data.length } });
  });
  router.get('/tasks', (req, res) => {
    const filters = parseFilters(new URL(req.originalUrl, 'http://localhost').searchParams);
    const data = store.listTasks(filters); res.json({ data, meta: { total: data.length, filters } });
  });
  router.get('/tasks/:id', requireTask(store), (req, res) => res.json({ data: req.task }));
  registerWriteRoutes(router, store);
  // Только локальный учебный сброс для кнопки клиента ПР8. Не публичный API.
  router.post('/debug/reset', (req, res) => res.json({ data: store.reset() }));
  const methods = [
    ['/health', 'GET, HEAD, OPTIONS'], ['/categories', 'GET, HEAD, OPTIONS'],
    ['/tasks', 'GET, HEAD, POST, OPTIONS'],
    ['/tasks/:id', 'GET, HEAD, PATCH, DELETE, OPTIONS'],
    ['/debug/reset', 'POST, OPTIONS'],
  ];
  for (const [path, allow] of methods) router.all(path, (req, res) => {
    res.set('Allow', allow);
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается.');
  });
  return router;
}
