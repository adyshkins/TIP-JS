import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, tasks } from '../src/data.js';
import { validateTaskDraft, selectTasks, getTaskStats, addTask, updateTask, toggleTask, removeTask } from '../src/domain/task-service.js';

const value = Object.freeze({ title: 'Новая задача', priority: 'high', categoryId: 2 });
const filters = Object.freeze({ q: '', completed: '', priority: '', categoryId: '' });
const ids = list => list.map(task => task.id);
const snapshot = JSON.stringify(tasks);

test('название нормализуется, categoryId становится числом', () => {
  const result = validateTaskDraft({ ...value, title: '  Новая задача  ', categoryId: '2' }, categories);
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, value);
  assert.deepEqual(result.errors, {});
});
for (const [name, draft, field] of [
  ['пробелы', { ...value, title: '   ' }, 'title'],
  ['название не строка', { ...value, title: 123 }, 'title'],
  ['101 символ', { ...value, title: 'я'.repeat(101) }, 'title'],
  ['неизвестный приоритет', { ...value, priority: 'urgent' }, 'priority'],
  ['несуществующая категория', { ...value, categoryId: '99' }, 'categoryId'],
  ['пустая категория', { ...value, categoryId: '' }, 'categoryId'],
  ['частично числовая категория', { ...value, categoryId: '2x' }, 'categoryId'],
  ['дробная категория', { ...value, categoryId: 1.5 }, 'categoryId'],
]) test(`валидация отклоняет: ${name}`, () => {
  const result = validateTaskDraft(draft, categories);
  assert.equal(result.valid, false);
  assert.equal(typeof result.errors[field], 'string');
  assert.ok(result.errors[field].length > 0);
});
test('100 символов допустимы', () => assert.equal(validateTaskDraft({ ...value, title: 'я'.repeat(100) }, categories).valid, true));
test('ошибки всех трёх полей возвращаются вместе', () => {
  const result = validateTaskDraft({ title: '', priority: '', categoryId: '' }, categories);
  assert.deepEqual(Object.keys(result.errors).sort(), ['categoryId', 'priority', 'title']);
});
test('пустые фильтры сохраняют порядок и весь набор', () => assert.deepEqual(ids(selectTasks(tasks, filters)), ids(tasks)));
test('поиск не зависит от регистра и внешних пробелов', () => assert.deepEqual(ids(selectTasks(tasks, { ...filters, q: '  ПРОВЕР  ' })), [7, 16]));
test('строка false означает невыполненные задачи', () => assert.deepEqual(ids(selectTasks(tasks, { ...filters, completed: 'false' })), [4, 7, 13, 19, 22, 28, 34]));
test('строка true означает выполненные задачи', () => assert.deepEqual(ids(selectTasks(tasks, { ...filters, completed: 'true' })), [1, 10, 16, 25, 31]));
test('фильтры объединяются через И', () => assert.deepEqual(ids(selectTasks(tasks, { ...filters, completed: 'false', priority: 'high', categoryId: '2' })), [4, 34]));
test('не найдено — пустой массив', () => assert.deepEqual(selectTasks(tasks, { ...filters, q: 'несуществующее название xyz' }), []));
test('статистика всего набора', () => assert.deepEqual(getTaskStats(tasks), { total: 12, completed: 5, active: 7 }));
test('статистика пустого набора', () => assert.deepEqual(getTaskStats([]), { total: 0, completed: 0, active: 0 }));
test('создание добавляет запись в конец, completed=false', () => {
  const next = addTask(tasks, value, 35);
  assert.notEqual(next, tasks);
  assert.equal(next.length, 13);
  assert.deepEqual(next.at(-1), { id: 35, ...value, completed: false });
  assert.deepEqual(next.slice(0, -1), tasks);
});
test('дублирующийся id отклоняется', () => assert.throws(() => addTask(tasks, value, 4)));
test('неположительный/нецелый id отклоняется', () => {
  for (const id of [0, -1, 1.5, NaN, '35']) assert.throws(() => addTask(tasks, value, id));
});
test('редактирование сохраняет id и completed', () => {
  const next = updateTask(tasks, 1, value);
  assert.notEqual(next, tasks);
  assert.deepEqual(next[0], { id: 1, ...value, completed: true });
  assert.deepEqual(next.slice(1), tasks.slice(1));
});
test('переключение меняет только выбранный статус', () => {
  const next = toggleTask(tasks, 4);
  assert.notEqual(next, tasks);
  assert.deepEqual(next[1], { ...tasks[1], completed: true });
  assert.deepEqual(next.filter(t => t.id !== 4), tasks.filter(t => t.id !== 4));
  assert.deepEqual(toggleTask(next, 4), tasks);
});
test('удаление по id при разрывах в нумерации', () => {
  const next = removeTask(tasks, 7);
  assert.notEqual(next, tasks);
  assert.deepEqual(ids(next), [1, 4, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
});
test('неизвестный id не меняет содержимое', () => {
  assert.deepEqual(updateTask(tasks, 999, value), tasks);
  assert.deepEqual(toggleTask(tasks, 999), tasks);
  assert.deepEqual(removeTask(tasks, 999), tasks);
});
test('операции принимают пустой набор', () => {
  assert.deepEqual(selectTasks([], filters), []);
  assert.deepEqual(removeTask([], 1), []);
  assert.deepEqual(toggleTask([], 1), []);
  assert.deepEqual(updateTask([], 1, value), []);
  assert.deepEqual(addTask([], value, 1), [{ id: 1, ...value, completed: false }]);
});
test('аргументы не изменяются при последовательности действий', () => {
  const draft = Object.freeze({ ...value, title: '  Тест  ', categoryId: '2' });
  validateTaskDraft(draft, categories);
  selectTasks(tasks, filters);
  getTaskStats(tasks);
  addTask(tasks, value, 35);
  updateTask(tasks, 1, value);
  toggleTask(tasks, 4);
  removeTask(tasks, 7);
  assert.equal(JSON.stringify(tasks), snapshot);
  assert.equal(draft.title, '  Тест  ');
});
