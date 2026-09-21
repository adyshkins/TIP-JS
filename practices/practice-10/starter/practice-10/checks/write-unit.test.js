import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTaskInput } from '../src/task-validation.js';
import { createStore } from '../src/store.js';
const options = { categoryIds: new Set([1, 2, 3]) };
const valid = { title: 'Новая задача', priority: 'high', categoryId: 2 };
const validate = (value, partial = false) => validateTaskInput(value, { ...options, partial });
function invalid(value, key, partial = false) {
  assert.throws(() => validate(value, partial), error => {
    assert.equal(error.status, 400); assert.equal(error.code, 'VALIDATION_ERROR');
    assert.ok(Object.hasOwn(error.details, key));
    assert.equal(typeof error.details[key], 'string');
    return true;
  });
}
test('POST: trim, новый объект, исходное значение не меняется', () => {
  const value = Object.freeze({ ...valid, title: '  Новая задача  ' });
  const result = validate(value);
  assert.deepEqual(result, valid); assert.notEqual(result, value);
  assert.equal(value.title, '  Новая задача  ');
});
for (const value of [null, [], 'text', 1, true]) {
  test(`Не объект: ${JSON.stringify(value)}`, () => invalid(value, 'body'));
}
for (const key of ['title', 'priority', 'categoryId']) {
  test(`POST требует ${key}`, () => { const value = { ...valid }; delete value[key]; invalid(value, key); });
}
for (const title of ['', '   ', 42, null, 'я'.repeat(101)]) {
  test(`Неверный title: ${JSON.stringify(title).slice(0, 30)}`, () => invalid({ ...valid, title }, 'title'));
}
test('title длиной 100 после trim разрешён', () => {
  assert.equal(validate({ ...valid, title: ' ' + 'я'.repeat(100) + ' ' }).title.length, 100);
});
for (const priority of ['', 'HIGH', 'urgent', null]) {
  test(`Неверный priority: ${priority}`, () => invalid({ ...valid, priority }, 'priority'));
}
for (const categoryId of ['2', 0, -1, 2.5, 999, null]) {
  test(`Неверная categoryId: ${JSON.stringify(categoryId)}`, () => invalid({ ...valid, categoryId }, 'categoryId'));
}
for (const key of ['id', 'completed', 'extra']) {
  test(`POST запрещает ${key}`, () => invalid({ ...valid, [key]: key === 'completed' ? false : 1 }, key));
}
test('PATCH: только completed:false без значений по умолчанию', () => {
  assert.deepEqual(validate({ completed: false }, true), { completed: false });
});
test('PATCH: title обрезается, остальные поля отсутствуют', () => {
  assert.deepEqual(validate({ title: '  Другое  ' }, true), { title: 'Другое' });
});
test('PATCH: полное разрешённое изменение', () => {
  assert.deepEqual(validate({ ...valid, completed: true }, true), { ...valid, completed: true });
});
for (const completed of ['false', 0, null]) {
  test(`PATCH отклоняет completed=${JSON.stringify(completed)}`, () => invalid({ completed }, 'completed', true));
}
test('PATCH пустой объект запрещён', () => invalid({}, 'body', true));
test('PATCH запрещает id', () => invalid({ id: 4 }, 'id', true));
test('Неизвестное __proto__ не теряется из details', () => {
  const value = JSON.parse('{"title":"X","priority":"high","categoryId":2,"__proto__":{"polluted":true}}');
  invalid(value, '__proto__'); assert.equal({}.polluted, undefined);
});
test('Несколько ошибок возвращаются в одном details', () => {
  assert.throws(() => validate({ title: '', priority: 'bad', categoryId: 999 }), error => {
    assert.deepEqual(Object.keys(error.details).sort(), ['categoryId', 'priority', 'title']); return true;
  });
});
test('Хранилище: id 35, completed:false, копия результата', () => {
  const store = createStore(); const input = { ...valid };
  const created = store.createTask(input);
  assert.deepEqual(created, { id: 35, ...valid, completed: false });
  created.title = 'changed'; input.title = 'changed';
  assert.equal(store.getTask(35).title, valid.title);
});
test('Удаление не приводит к повторному использованию id', () => {
  const store = createStore(); const first = store.createTask(valid);
  assert.equal(store.deleteTask(first.id), true);
  const second = store.createTask(valid); assert.equal(second.id, first.id + 1);
  assert.equal(store.deleteTask(first.id), false);
});
test('PATCH сохраняет непереданные поля и возвращает копию', () => {
  const store = createStore(); const before = store.getTask(1);
  const result = store.updateTask(1, { title: 'Обновлено' });
  assert.deepEqual(result, { ...before, title: 'Обновлено' });
  result.title = 'changed'; assert.equal(store.getTask(1).title, 'Обновлено');
  assert.equal(store.updateTask(2, { title: 'Нет' }), null);
});
test('GET и список не раскрывают изменяемые ссылки хранилища', () => {
  const store = createStore(); store.getTask(1).title = 'X'; store.listTasks()[0].title = 'Y';
  assert.equal(store.getTask(1).title, 'Изучить функции');
});
test('Два экземпляра хранилища изолированы; reset восстанавливает id', () => {
  const a = createStore(), b = createStore();
  a.createTask(valid); assert.equal(b.listTasks().length, 12);
  assert.deepEqual(a.reset(), { reset: true, total: 12 });
  assert.equal(a.createTask(valid).id, 35);
});
