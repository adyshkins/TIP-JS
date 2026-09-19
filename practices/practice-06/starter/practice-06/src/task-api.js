import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

export function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

// Методы результата:
// getTasks, getTaskById, getCategories, loadInitialData, createTask, updateTask,
// setTaskCompleted, deleteTask и resetDemoData.
// Последний аргумент каждого метода данных — { signal }.
export function createTaskApi(client) {
  void client;
  void ALLOWED_FILTERS;
  void invalidResponse;
  void isTask;
  void isCategory;

  // Перенесите getTasks/getCategories/loadInitialData из ПР5 и добавьте:
  // getTaskById(id)               -> GET /tasks/:id
  // createTask(draft)             -> POST /tasks
  // updateTask(id, changes)       -> PATCH /tasks/:id
  // setTaskCompleted(id, value)   -> PATCH /tasks/:id
  // deleteTask(id)                -> DELETE /tasks/:id, ожидается null
  // resetDemoData()               -> POST /debug/reset без тела
  // Любая полученная задача и категория проверяется до передачи интерфейсу.
  throw new Error("Не реализовано: createTaskApi");
}
