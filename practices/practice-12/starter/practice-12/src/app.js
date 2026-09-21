import express from 'express';
import { createRouter } from './routes.js';
import { ApiError, errorHandler } from './errors.js';

export function createApp({ store, enableDebugReset = false } = {}) {
  if (!store) throw new TypeError('Для приложения требуется хранилище.');
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('case sensitive routing', true);
  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      'Access-Control-Expose-Headers': 'Location',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  app.use('/api', createRouter(store, { enableDebugReset }));
  app.use((req, res, next) => next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Маршрут не найден.')));
  app.use(errorHandler);
  return app;
}
