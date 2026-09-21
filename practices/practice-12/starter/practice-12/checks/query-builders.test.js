import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildListTasksQuery,
  buildUpdateTaskQuery,
  escapeLikePattern,
} from '../src/query-builders.js';

const compact = value => value.replace(/\s+/g, ' ').trim();
const empty = { completed: null, priority: null, categoryId: null, q: '' };

test('escapeLikePattern сохраняет буквальный смысл специальных символов', () => {
  assert.equal(escapeLikePattern('50%_готово\\да'), '50\\%\\_готово\\\\да');
});

test('список без фильтров не содержит WHERE и всегда упорядочен', () => {
  const query = buildListTasksQuery(empty);
  const sql = compact(query.text);
  assert.deepEqual(query.values, []);
  assert.match(sql, /^SELECT id, title, completed, priority, category_id AS "categoryId" FROM public\.tasks/i);
  assert.doesNotMatch(sql, /\bWHERE\b/i);
  assert.match(sql, /ORDER BY id$/i);
});

test('все фильтры используют последовательные параметры', () => {
  const filters = { completed: false, priority: 'high', categoryId: 2, q: '50%_ПРОВЕР\\' };
  const query = buildListTasksQuery(filters);
  const sql = compact(query.text);
  assert.deepEqual(query.values, [false, 'high', 2, '%50\\%\\_ПРОВЕР\\\\%']);
  assert.match(sql, /completed\s*=\s*\$1/i);
  assert.match(sql, /priority\s*=\s*\$2/i);
  assert.match(sql, /category_id\s*=\s*\$3/i);
  assert.match(sql, /title\s+ILIKE\s+\$4\s+ESCAPE\s+'\\'/i);
  assert.doesNotMatch(sql, /50%|ПРОВЕР/);
  assert.match(sql, /ORDER BY id$/i);
});

test('один фильтр q начинается с $1', () => {
  const query = buildListTasksQuery({ ...empty, q: 'api' });
  assert.deepEqual(query.values, ['%api%']);
  assert.match(compact(query.text), /WHERE title ILIKE \$1 ESCAPE '\\' ORDER BY id$/i);
});

test('UPDATE отображает поля в фиксированном порядке и id передаёт последним', () => {
  const query = buildUpdateTaskQuery(34, {
    categoryId: 3,
    priority: 'low',
    completed: true,
    title: 'Готово',
  });
  const sql = compact(query.text);
  assert.deepEqual(query.values, ['Готово', true, 'low', 3, 34]);
  assert.match(sql, /^UPDATE public\.tasks SET title = \$1, completed = \$2, priority = \$3, category_id = \$4 WHERE id = \$5 RETURNING/i);
  assert.match(sql, /category_id AS "categoryId"$/i);
});

test('UPDATE одного boolean-поля не теряет false', () => {
  const query = buildUpdateTaskQuery(4, { completed: false });
  assert.deepEqual(query.values, [false, 4]);
  assert.match(compact(query.text), /SET completed = \$1 WHERE id = \$2/i);
});

test('UPDATE отклоняет пустой или неизвестный набор изменений', () => {
  assert.throws(() => buildUpdateTaskQuery(1, {}), /измен|пол/i);
  assert.throws(() => buildUpdateTaskQuery(1, { role: 'admin' }), /неизвест|пол/i);
});
