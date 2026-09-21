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
  const conditions = [];
  const values = [];
  const add = (fragment, value) => {
    values.push(value);
    conditions.push(`${fragment} $${values.length}`);
  };
  if (filters.completed !== null) {
    add('completed =', filters.completed);
  }
  if (filters.priority !== null) {
    add('priority =', filters.priority);
  }
  if (filters.categoryId !== null) {
    add('category_id =', filters.categoryId);
  }
  if (filters.q) {
    add('title ILIKE', `%${escapeLikePattern(filters.q)}%`);
  }
  if (filters.q) {
    conditions[conditions.length - 1] += " ESCAPE '\\'";
  }
  const where = conditions.length ? `\nWHERE ${conditions.join('\n  AND ')}` : '';
  return { text: `SELECT ${taskColumns}\nFROM public.tasks${where}\nORDER BY id`, values };
}

export function buildUpdateTaskQuery(id, changes) {
  const columns = [
    ['title', 'title'],
    ['completed', 'completed'],
    ['priority', 'priority'],
    ['categoryId', 'category_id'],
  ];
  const allowed = new Set(columns.map(([name]) => name));
  for (const name of Object.keys(changes)) {
    if (!allowed.has(name)) {
      throw new TypeError(`Неизвестное поле изменения: ${name}`);
    }
  }
  const values = [];
  const assignments = [];
  for (const [name, column] of columns) {
    if (Object.hasOwn(changes, name)) {
      values.push(changes[name]);
      assignments.push(`${column} = $${values.length}`);
    }
  }
  if (!assignments.length) {
    throw new TypeError('Нужно хотя бы одно поле изменения.');
  }
  values.push(id);
  return {
    text: `UPDATE public.tasks SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING ${taskColumns}`,
    values,
  };
}
