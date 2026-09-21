import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildListTasksQuery,
  buildUpdateTaskQuery,
  escapeLikePattern,
} from '../../src/query-builders.js';

const compact = (value) => value.replace(/\s+/g, ' ').trim();
const empty = { completed: null, priority: null, categoryId: null, q: '' };

test('escapeLikePattern не изменяет обычный текст', () => {
  assert.equal(escapeLikePattern('обычный текст'), 'обычный текст');
});

test('SELECT без фильтров не содержит WHERE и имеет порядок', () => {
  const query = buildListTasksQuery(empty);
  assert.deepEqual(query.values, []);
  assert.doesNotMatch(query.text, /\bWHERE\b/i);
  assert.match(compact(query.text), /FROM public\.tasks ORDER BY id$/i);
});

test('SELECT нумерует все параметры в фиксированном порядке', () => {
  const query = buildListTasksQuery({
    completed: false,
    priority: 'high',
    categoryId: 2,
    q: 'api',
  });
  assert.deepEqual(query.values, [false, 'high', 2, '%api%']);
  assert.match(compact(query.text), /completed = \$1.*priority = \$2.*category_id = \$3/i);
  assert.match(compact(query.text), /title ILIKE \$4 ESCAPE '\\'/i);
});

test('UPDATE использует фиксированный порядок независимо от JSON', () => {
  const query = buildUpdateTaskQuery(34, {
    categoryId: 3,
    priority: 'low',
    title: 'Готово',
  });
  assert.deepEqual(query.values, ['Готово', 'low', 3, 34]);
  assert.match(
    compact(query.text),
    /SET title = \$1, priority = \$2, category_id = \$3 WHERE id = \$4/i,
  );
});

test.todo('escapeLikePattern экранирует %, _ и обратную косую черту');
test.todo('SELECT не помещает пользовательский q в SQL-текст');
test.todo('UPDATE одного completed сохраняет значение false');
test.todo('UPDATE отклоняет пустой и неизвестный набор изменений');
