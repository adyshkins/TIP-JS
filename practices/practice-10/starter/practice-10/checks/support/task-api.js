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


// Готовый адаптер. Возвращает проверенные предметные данные без HTTP-конверта.
export function createTaskApi(client) {
  const idPath = id => {
    if (!isPositiveSafeInteger(id)) throw new TypeError('Неверный id.');
    return `/tasks/${id}`;
  };
  const taskFrom = payload => {
    if (!isTask(payload?.data)) throw invalidResponse('Неверная схема задачи.');
    return payload.data;
  };
  const api = {
    async getTasks(filters = {}, options = {}) {
      for (const key of Object.keys(filters)) if (!ALLOWED_FILTERS.has(key)) throw new TypeError(`Неизвестный фильтр: ${key}`);
      const payload = await client.requestJson('/tasks', { ...options, query: filters });
      if (!Array.isArray(payload?.data) || !payload.data.every(isTask)
          || !Number.isSafeInteger(payload.meta?.total) || payload.meta.total !== payload.data.length
          || new Set(payload.data.map(t => t.id)).size !== payload.data.length) {
        throw invalidResponse('Неверная схема списка задач.');
      }
      return { tasks: payload.data, meta: payload.meta };
    },
    async getCategories(options = {}) {
      const payload = await client.requestJson('/categories', options);
      if (!Array.isArray(payload?.data) || !payload.data.every(isCategory)
          || new Set(payload.data.map(c => c.id)).size !== payload.data.length) throw invalidResponse('Неверная схема категорий.');
      return payload.data;
    },
    async loadInitialData(filters = {}, options = {}) {
      const [result, categories] = await Promise.all([api.getTasks(filters, options), api.getCategories(options)]);
      return { ...result, categories };
    },
    async getTaskById(id, options = {}) { return taskFrom(await client.requestJson(idPath(id), options)); },
    async createTask(value, options = {}) { return taskFrom(await client.requestJson('/tasks', { ...options, method: 'POST', body: value })); },
    async updateTask(id, value, options = {}) { return taskFrom(await client.requestJson(idPath(id), { ...options, method: 'PATCH', body: value })); },
    async setTaskCompleted(id, completed, options = {}) { return api.updateTask(id, { completed }, options); },
    async deleteTask(id, options = {}) {
      const result = await client.requestJson(idPath(id), { ...options, method: 'DELETE' });
      if (result !== null) throw invalidResponse('DELETE должен вернуть пустое тело.');
      return null;
    },
    async resetDemoData(options = {}) {
      const payload = await client.requestJson('/debug/reset', { ...options, method: 'POST' });
      if (payload?.data?.reset !== true || !Number.isSafeInteger(payload.data.total) || payload.data.total < 0) throw invalidResponse('Неверный ответ reset.');
      return payload.data;
    },
  };
  return api;
}
