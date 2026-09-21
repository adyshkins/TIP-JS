import { notImplemented } from './errors.js';
import { jsonBody } from './json-body.js';
import { requireTask } from './task-resource.js';
// Добавить импорт ApiError из errors.js и validateTaskInput из task-validation.js.
export function registerWriteRoutes(router, store) {
  router.post('/tasks', ...jsonBody, (req, res) => {
    // TODO: categoryIds из store.listCategories(); валидация req.body;
    // store.createTask; 201, Location: /api/tasks/<id>, { data: task }.
    notImplemented('POST /tasks');
  });
  router.patch('/tasks/:id', requireTask(store), ...jsonBody, (req, res) => {
    // TODO: валидация с partial:true; store.updateTask(req.task.id, changes);
    // Если updateTask вернул null: 404 TASK_NOT_FOUND с details.id.
    // Иначе 200, { data: task }. Не добавлять отсутствующие поля.
    notImplemented('PATCH /tasks/:id');
  });
  router.delete('/tasks/:id', requireTask(store), (req, res) => {
    // TODO: store.deleteTask(req.task.id); при false: 404 TASK_NOT_FOUND.
    // При true: 204 и end(), без JSON.
    notImplemented('DELETE /tasks/:id');
  });
}
