// Чистые функции: без React, DOM, сети, случайных значений и изменения аргументов.
// Точные контракты и допустимые входы приведены в методичке.
export function validateTaskDraft(draft, categories) {
  // TODO: { valid, value: { title, priority, categoryId }, errors }.
  throw new Error('Не реализовано: validateTaskDraft');
}
export function selectTasks(tasks, filters) {
  // TODO: совместное применение q, completed, priority, categoryId.
  throw new Error('Не реализовано: selectTasks');
}
export function getTaskStats(tasks) {
  // TODO: { total, completed, active } по всему массиву.
  throw new Error('Не реализовано: getTaskStats');
}
export function addTask(tasks, value, id) {
  // TODO: новый массив, новая задача completed:false, проверка уникального id.
  throw new Error('Не реализовано: addTask');
}
export function updateTask(tasks, id, value) {
  // TODO: заменить title/priority/categoryId, сохранить id и completed.
  throw new Error('Не реализовано: updateTask');
}
export function toggleTask(tasks, id) {
  // TODO: инвертировать completed только у найденной задачи.
  throw new Error('Не реализовано: toggleTask');
}
export function removeTask(tasks, id) {
  // TODO: удалить задачу по id.
  throw new Error('Не реализовано: removeTask');
}
