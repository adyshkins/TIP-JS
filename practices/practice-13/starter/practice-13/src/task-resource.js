import { ApiError } from './errors.js';
import { parsePositiveId } from './validation.js';

export function requireTask(store) {
  return async (req, res, next) => {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      throw new ApiError(400, 'INVALID_ID', 'Некорректный id.');
    }
    const task = await store.getTask(id);
    if (!task) {
      throw new ApiError(404, 'TASK_NOT_FOUND', 'Задача не найдена.', { id });
    }
    req.task = task;
    next();
  };
}
