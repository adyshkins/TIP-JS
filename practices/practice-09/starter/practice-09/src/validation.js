import { notImplemented } from './errors.js';

// raw: строка; результат: безопасное положительное целое либо null.
export function parsePositiveId(raw) {
  return notImplemented('parsePositiveId');
}

// URLSearchParams -> { completed: boolean|null, priority: string|null,
// categoryId: number|null, q: string }. Ошибка: ApiError(400, 'INVALID_QUERY', ...).
// Неизвестные и повторяющиеся параметры запрещены. Правила — в методичке.
export function parseFilters(searchParams) {
  return notImplemented('parseFilters');
}
