import { notImplemented } from './errors.js';
// Добавить импорт ApiError. categoryIds — Set существующих id категорий.
// Возвращает НОВЫЙ объект только с нормализованными разрешёнными полями.
// partial=false: title, priority, categoryId обязательны; completed/id запрещены.
// partial=true: хотя бы одно из title, priority, categoryId, completed; id запрещён.
// Ошибка: ApiError(400, 'VALIDATION_ERROR', сообщение, details).
// Для неизвестных имён безопасно использовать Object.create(null) в details.
export function validateTaskInput(value, { partial = false, categoryIds } = {}) {
  return notImplemented('validateTaskInput');
}
