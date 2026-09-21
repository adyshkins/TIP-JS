import { ApiError } from './errors.js';

const PRIORITIES = new Set(['low', 'medium', 'high']);
const FILTER_NAMES = new Set(['completed', 'priority', 'categoryId', 'q']);

function oneValue(searchParams, name) {
  const values = searchParams.getAll(name);
  if (values.length > 1) {
    throw new ApiError(400, 'INVALID_QUERY', `Параметр ${name} нельзя повторять.`);
  }
  return values[0] ?? null;
}

export function parsePositiveId(raw) {
  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 2147483647 ? value : null;
}

export function parseFilters(searchParams) {
  for (const name of searchParams.keys()) {
    if (!FILTER_NAMES.has(name)) {
      throw new ApiError(400, 'INVALID_QUERY', `Неизвестный параметр запроса: ${name}.`);
    }
  }

  const filters = { completed: null, priority: null, categoryId: null, q: '' };
  const completed = oneValue(searchParams, 'completed');
  if (completed !== null) {
    if (!['true', 'false'].includes(completed)) {
      throw new ApiError(400, 'INVALID_QUERY', 'completed должен быть true или false.');
    }
    filters.completed = completed === 'true';
  }

  const priority = oneValue(searchParams, 'priority');
  if (priority !== null) {
    if (!PRIORITIES.has(priority)) {
      throw new ApiError(400, 'INVALID_QUERY', 'priority должен быть low, medium или high.');
    }
    filters.priority = priority;
  }

  const categoryId = oneValue(searchParams, 'categoryId');
  if (categoryId !== null) {
    const parsed = parsePositiveId(categoryId);
    if (parsed === null) {
      throw new ApiError(
        400,
        'INVALID_QUERY',
        'categoryId должен быть положительным integer PostgreSQL.',
      );
    }
    filters.categoryId = parsed;
  }

  const q = oneValue(searchParams, 'q');
  if (q !== null) {
    filters.q = q.trim();
    if (filters.q.length > 100) {
      throw new ApiError(400, 'INVALID_QUERY', 'q не должен быть длиннее 100 символов.');
    }
  }
  return filters;
}
