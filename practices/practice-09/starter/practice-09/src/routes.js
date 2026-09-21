import { Router } from 'express';
import { notImplemented } from './errors.js';
// Добавить импорты ApiError, parsePositiveId и parseFilters по мере реализации.

export function createRouter(store) {
  const router = Router({ caseSensitive: true });
  router.get('/health', (req, res) => res.json({ data: { status: 'ok' } }));

  router.get('/categories', (req, res) => {
    // TODO: store.listCategories(), data и meta.total.
    notImplemented('GET /categories');
  });
  router.get('/tasks', (req, res) => {
    // TODO: URL(req.originalUrl, 'http://localhost').searchParams,
    // parseFilters, store.listTasks(filters), data и meta.
    notImplemented('GET /tasks');
  });
  router.get('/tasks/:id', (req, res) => {
    // TODO: проверка req.params.id, поиск, 400/404/200.
    notImplemented('GET /tasks/:id');
  });

  // TODO: после GET добавить router.all для четырёх известных путей:
  // /health, /categories, /tasks, /tasks/:id.
  // Ответ 405 METHOD_NOT_ALLOWED, заголовок Allow: GET, HEAD, OPTIONS.
  // OPTIONS уже обработан приложением; HEAD поддерживается GET-маршрутами.
  return router;
}
