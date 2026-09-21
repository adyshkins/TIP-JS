import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePositiveId, parseFilters } from '../src/validation.js';
import { selectTasks, findTask } from '../src/task-service.js';
import { tasks } from '../src/data.js';
const empty = { completed: null, priority: null, categoryId: null, q: '' };

for (const raw of ['1', '4', '9007199254740991']) {
  test(`id принимает ${raw}`, () => assert.equal(parsePositiveId(raw), Number(raw)));
}
for (const raw of ['', '0', '-1', '01', '1.5', '1e2', '4abc', ' 4 ', '9007199254740992']) {
  test(`id отклоняет ${JSON.stringify(raw)}`, () => assert.equal(parsePositiveId(raw), null));
}
test('Пустой запрос возвращает все значения по умолчанию', () => {
  assert.deepEqual(parseFilters(new URLSearchParams()), empty);
});
test('Нормализация false, категории и пробелов поиска', () => {
  assert.deepEqual(parseFilters(new URLSearchParams('completed=false&priority=high&categoryId=2&q=  API  ')),
    { completed: false, priority: 'high', categoryId: 2, q: 'API' });
});
test('true преобразуется в boolean', () => {
  assert.equal(parseFilters(new URLSearchParams('completed=true')).completed, true);
});
for (const query of ['unknown=1', 'q=a&q=b', 'completed=false&completed=true',
  'priority=low&priority=high', 'categoryId=1&categoryId=2', 'completed=', 'completed=0',
  'completed=False', 'priority=', 'priority=HIGH', 'categoryId=0', 'categoryId=01',
  'categoryId=2abc', 'categoryId=9007199254740992', `q=${'я'.repeat(101)}`]) {
  test(`INVALID_QUERY: ${query.slice(0, 60)}`, () => {
    assert.throws(() => parseFilters(new URLSearchParams(query)),
      error => error.status === 400 && error.code === 'INVALID_QUERY');
  });
}
test('Граница q: 100 после trim и пустая строка разрешены', () => {
  assert.equal(parseFilters(new URLSearchParams({ q: ' ' + 'я'.repeat(100) + ' ' })).q.length, 100);
  assert.equal(parseFilters(new URLSearchParams('q=   ')).q, '');
});
test('Неизвестная положительная категория допустима как фильтр', () => {
  assert.equal(parseFilters(new URLSearchParams('categoryId=999')).categoryId, 999);
});
test('Фильтры отсутствуют: все задачи без мутации исходных данных', () => {
  const before = JSON.stringify(tasks);
  assert.deepEqual(selectTasks(tasks, empty), tasks);
  assert.equal(JSON.stringify(tasks), before);
});
test('AND: false, high, категория 2', () => {
  assert.deepEqual(selectTasks(tasks, { ...empty, completed: false, priority: 'high', categoryId: 2 }).map(t => t.id), [4, 34]);
});
test('Поиск без учёта регистра и без изменения порядка', () => {
  assert.deepEqual(selectTasks(tasks, { ...empty, q: 'ПРОВЕР' }).map(t => t.id), [7, 16]);
});
test('Пустая выборка — массив, не ошибка', () => {
  assert.deepEqual(selectTasks(tasks, { ...empty, categoryId: 999 }), []);
  assert.deepEqual(selectTasks([], empty), []);
});
test('Поиск по id, отсутствующая задача и разреженные id', () => {
  assert.deepEqual(findTask(tasks, 4), tasks[1]);
  assert.equal(findTask(tasks, 2), null);
});
test('Логика работает с другим массивом, без жёстко заданных id', () => {
  const data = Object.freeze([Object.freeze({ id: 101, title: 'Новая ЗАДАЧА', completed: false, priority: 'low', categoryId: 8 })]);
  assert.deepEqual(selectTasks(data, { ...empty, q: 'задача', categoryId: 8 }), data);
  assert.equal(findTask(data, 101), data[0]);
});
