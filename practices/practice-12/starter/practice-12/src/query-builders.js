import { notImplemented } from './errors.js';

export const taskColumns = `
  id,
  title,
  completed,
  priority,
  category_id AS "categoryId"`;

// В LIKE/ILIKE символы %, _ и \ имеют специальный смысл. API ПР10 выполнял
// буквальный поиск подстроки, поэтому перед добавлением % их нужно экранировать.
export function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function buildListTasksQuery(filters) {
  // TODO: вернуть { text, values }.
  // Добавлять только фиксированные SQL-фрагменты, а значения передавать через
  // $1, $2, ... . Условия: completed, priority, category_id и буквальный q.
  // Для q: title ILIKE $n ESCAPE '\\', значение `%${escapeLikePattern(q)}%`.
  // Результат должен содержать taskColumns и завершаться ORDER BY id.
  return notImplemented('buildListTasksQuery');
}

export function buildUpdateTaskQuery(id, changes) {
  // TODO: вернуть { text, values } для UPDATE public.tasks.
  // Разрешённый фиксированный порядок: title, completed, priority, categoryId.
  // categoryId отображается в category_id. В values сначала идут изменяемые
  // значения, последним — id. Завершить WHERE id = $n RETURNING taskColumns.
  return notImplemented('buildUpdateTaskQuery');
}
