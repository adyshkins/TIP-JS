import { ApiError } from './errors.js';
import { parsePositiveId } from './validation.js';
// Используется GET/PATCH/DELETE. Проверка id и существования раньше разбора PATCH.
export function requireTask(store) {
  return (req, res, next) => {
    const id = parsePositiveId(req.params.id);
    if (id === null) throw new ApiError(400, 'INVALID_ID', 'Некорректный id.');
    const task = store.getTask(id);
    if (!task) throw new ApiError(404, 'TASK_NOT_FOUND', 'Задача не найдена.', { id });
    req.task = task;
    next();
  };
}
