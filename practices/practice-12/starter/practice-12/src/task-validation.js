import { ApiError } from './errors.js';

const PRIORITIES = new Set(['low', 'medium', 'high']);
const CREATE_FIELDS = new Set(['title', 'priority', 'categoryId']);
const PATCH_FIELDS = new Set(['title', 'completed', 'priority', 'categoryId']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateTaskInput(value, { partial = false, categoryIds } = {}) {
  if (!isPlainObject(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Тело должно быть JSON-объектом.');
  }
  if (!(categoryIds instanceof Set)) throw new TypeError('categoryIds должен быть Set.');

  const allowed = partial ? PATCH_FIELDS : CREATE_FIELDS;
  const details = Object.create(null);
  for (const name of Object.keys(value)) {
    if (!allowed.has(name)) details[name] = 'Неизвестное или запрещённое поле.';
  }

  if (!partial) {
    for (const name of CREATE_FIELDS) {
      if (!Object.hasOwn(value, name)) details[name] = 'Поле обязательно.';
    }
  } else if (!Object.keys(value).some(name => allowed.has(name))) {
    details.body = 'Нужно передать хотя бы одно изменяемое поле.';
  }

  const result = {};
  if (Object.hasOwn(value, 'title')) {
    if (typeof value.title !== 'string') {
      details.title = 'Название должно быть строкой.';
    } else {
      const title = value.title.trim();
      if (title.length < 1 || title.length > 100) {
        details.title = 'Длина названия после trim должна быть от 1 до 100.';
      } else {
        result.title = title;
      }
    }
  }
  if (Object.hasOwn(value, 'completed')) {
    if (typeof value.completed !== 'boolean') details.completed = 'Статус должен быть boolean.';
    else result.completed = value.completed;
  }
  if (Object.hasOwn(value, 'priority')) {
    if (typeof value.priority !== 'string' || !PRIORITIES.has(value.priority)) {
      details.priority = 'Приоритет должен быть low, medium или high.';
    } else {
      result.priority = value.priority;
    }
  }
  if (Object.hasOwn(value, 'categoryId')) {
    if (!Number.isInteger(value.categoryId) || value.categoryId < 1 || value.categoryId > 2147483647) {
      details.categoryId = 'categoryId должен быть положительным integer PostgreSQL.';
    } else if (!categoryIds.has(value.categoryId)) {
      details.categoryId = 'Категория не найдена.';
    } else {
      result.categoryId = value.categoryId;
    }
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Проверьте данные задачи.', details);
  }
  return result;
}
