import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../src/errors.js';
import { validateTaskInput } from '../../src/task-validation.js';
import { parseFilters, parsePositiveId } from '../../src/validation.js';

const categories = new Set([1, 2, 3]);

test('parsePositiveId принимает диапазон integer PostgreSQL', () => {
  assert.equal(parsePositiveId('1'), 1);
  assert.equal(parsePositiveId('2147483647'), 2147483647);
});

test('parsePositiveId отклоняет неоднозначные и недопустимые значения', () => {
  for (const value of ['0', '-1', '+1', '01', '1.0', ' 1', '2147483648', 'abc']) {
    assert.equal(parsePositiveId(value), null, value);
  }
});

test('parseFilters разбирает полный набор фильтров', () => {
  const params = new URLSearchParams({
    completed: 'false',
    priority: 'high',
    categoryId: '2',
    q: '  ПРОВЕР  ',
  });
  assert.deepEqual(parseFilters(params), {
    completed: false,
    priority: 'high',
    categoryId: 2,
    q: 'ПРОВЕР',
  });
});

test('parseFilters возвращает нейтральные значения без query', () => {
  assert.deepEqual(parseFilters(new URLSearchParams()), {
    completed: null,
    priority: null,
    categoryId: null,
    q: '',
  });
});

test('parseFilters отклоняет неизвестный и повторённый параметр', () => {
  assert.throws(
    () => parseFilters(new URLSearchParams('page=1')),
    (error) => error instanceof ApiError && error.code === 'INVALID_QUERY',
  );
  assert.throws(
    () => parseFilters(new URLSearchParams('q=a&q=b')),
    (error) => error instanceof ApiError && error.code === 'INVALID_QUERY',
  );
});

test('validateTaskInput нормализует POST без изменения исходного объекта', () => {
  const source = { title: '  Новая задача  ', priority: 'medium', categoryId: 2 };
  const result = validateTaskInput(source, { categoryIds: categories });
  assert.deepEqual(result, { title: 'Новая задача', priority: 'medium', categoryId: 2 });
  assert.equal(source.title, '  Новая задача  ');
  assert.notEqual(result, source);
});

test('validateTaskInput сохраняет false при частичном обновлении', () => {
  assert.deepEqual(
    validateTaskInput({ completed: false }, { partial: true, categoryIds: categories }),
    { completed: false },
  );
});

test.todo('validateTaskInput отклоняет не-объект, массив и null');
test.todo('validateTaskInput сообщает обязательные и неизвестные поля POST');
test.todo('validateTaskInput отклоняет пустой PATCH и несуществующую категорию');
test.todo('validateTaskInput проверяет границы title, priority и тип completed');
