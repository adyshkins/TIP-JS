import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useTaskData } from '../src/hooks/useTaskData.js';

// Готовая тестовая инфраструктура. Настоящий React, DOM эмулируется, сеть заменена API-заглушкой.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const emptyFilters = { q: '', completed: '', priority: '', categoryId: '' };
const task = { id: 4, title: 'Задача', completed: false, priority: 'high', categoryId: 2 };
const snapshot = { tasks: [task], categories: [{ id: 2, name: 'Проект' }], meta: { total: 1 } };
const value = { title: 'Новая', priority: 'high', categoryId: 2 };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fakeApi() {
  const reads = [], writes = [];
  const mutate = method => (...args) => {
    const pending = deferred(); writes.push({ method, args, ...pending }); return pending.promise;
  };
  return {
    reads, writes,
    loadInitialData(filters, { signal } = {}) {
      const pending = deferred(); reads.push({ filters: { ...filters }, signal, ...pending }); return pending.promise;
    },
    createTask: mutate('create'), updateTask: mutate('update'), setTaskCompleted: mutate('toggle'),
    deleteTask: mutate('delete'), resetDemoData: mutate('reset'),
  };
}
let roots = [];
afterEach(async () => { for (const root of roots) await act(async () => root.unmount()); roots = []; document.body.replaceChildren(); });
async function mount(api, filters = emptyFilters, strict = false) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); roots.push(root);
  let current;
  function Probe(props) { current = useTaskData(props); return null; }
  async function render(next = filters) {
    filters = next;
    await act(async () => root.render(strict ? createElement(StrictMode, null, createElement(Probe, { api, filters })) : createElement(Probe, { api, filters })));
  }
  await render();
  return { get current() { return current; }, render, async unmount() { await act(async () => root.unmount()); roots = roots.filter(r => r !== root); } };
}
async function ready(api, view) {
  assert.ok(api.reads.length > 0, 'Хук должен запустить loadInitialData');
  await act(async () => api.reads.at(-1).resolve(structuredClone(snapshot)));
  assert.equal(view.current.status, 'ready');
}

test('01. загрузка переходит из loading в ready', async () => {
  const api = fakeApi(), view = await mount(api);
  assert.equal(view.current.status, 'loading');
  assert.equal(api.reads.length, 1);
  assert.equal(api.reads[0].signal.aborted, false);
  await ready(api, view);
  assert.deepEqual(view.current.snapshot, snapshot);
});
test('02. пустой успешный ответ остаётся ready', async () => {
  const api = fakeApi(), view = await mount(api);
  assert.ok(api.reads[0]);
  await act(async () => api.reads[0].resolve({ ...snapshot, tasks: [], meta: { total: 0 } }));
  assert.equal(view.current.status, 'ready');
  assert.deepEqual(view.current.snapshot.tasks, []);
});
test('03. ошибка первой загрузки и успешный повтор', async () => {
  const api = fakeApi(), view = await mount(api), error = new Error('Сеть');
  assert.ok(api.reads[0]);
  await act(async () => api.reads[0].reject(error));
  assert.equal(view.current.status, 'error'); assert.equal(view.current.error, error);
  await act(async () => view.current.refresh());
  assert.equal(api.reads.length, 2);
  await ready(api, view); assert.equal(view.current.error, null);
});
test('04. фильтры передаются API, прежний запрос отменяется', async () => {
  const api = fakeApi(), view = await mount(api);
  assert.ok(api.reads[0]);
  const first = api.reads[0];
  const filters = { ...emptyFilters, completed: 'false', q: 'новая', categoryId: '2' };
  await view.render(filters);
  assert.equal(first.signal.aborted, true);
  assert.deepEqual(api.reads.at(-1).filters, filters);
  await ready(api, view);
  await act(async () => first.resolve({ ...snapshot, tasks: [], meta: { total: 0 } }));
  assert.deepEqual(view.current.snapshot, snapshot, 'Запоздавший успех не заменяет свежие данные');
});
test('05. запоздавшая ошибка не портит свежий результат', async () => {
  const api = fakeApi(), view = await mount(api); assert.ok(api.reads[0]);
  const first = api.reads[0];
  await view.render({ ...emptyFilters, q: 'другая' }); await ready(api, view);
  await act(async () => first.reject(new Error('Старая ошибка')));
  assert.equal(view.current.status, 'ready'); assert.equal(view.current.error, null);
});
test('06. ошибка обновления сохраняет последний снимок', async () => {
  const api = fakeApi(), view = await mount(api); await ready(api, view);
  await act(async () => view.current.refresh());
  assert.deepEqual(view.current.snapshot, snapshot);
  await act(async () => api.reads.at(-1).reject(new Error('Нет связи')));
  assert.equal(view.current.status, 'error'); assert.deepEqual(view.current.snapshot, snapshot);
});
test('07. StrictMode отменяет пробную загрузку, результат актуального эффекта принимается', async () => {
  const api = fakeApi(), view = await mount(api, emptyFilters, true);
  assert.ok(api.reads.length >= 2);
  assert.equal(api.reads[0].signal.aborted, true);
  await ready(api, view);
  await act(async () => api.reads[0].reject(Object.assign(new Error('Отмена'), { kind: 'aborted' })));
  assert.equal(view.current.status, 'ready');
});
test('08. размонтирование отменяет загрузку', async () => {
  const api = fakeApi(), view = await mount(api); assert.ok(api.reads[0]);
  await view.unmount(); assert.equal(api.reads[0].signal.aborted, true);
  await act(async () => api.reads[0].resolve(snapshot));
});
test('09. создание идёт на сервер; затем повторяется текущий фильтр', async () => {
  const api = fakeApi(), filters = { ...emptyFilters, priority: 'high' }, view = await mount(api, filters);
  await ready(api, view); let result;
  await act(async () => { result = view.current.saveTask(null, value); });
  assert.equal(view.current.pending, true);
  assert.equal(api.writes[0].method, 'create'); assert.deepEqual(api.writes[0].args[0], value);
  assert.equal(api.reads.length, 1);
  await act(async () => { api.writes[0].resolve({ ...task, ...value, id: 35 }); assert.equal(await result, true); });
  assert.equal(api.reads.length, 2); assert.deepEqual(api.reads.at(-1).filters, filters);
  assert.equal(view.current.pending, false); await ready(api, view);
});
test('10. ошибка мутации сохраняется отдельно, повтор разрешён', async () => {
  const api = fakeApi(), view = await mount(api); await ready(api, view);
  let result; const error = Object.assign(new Error('Проверка полей'), { status: 400, details: { title: 'Ошибка' } });
  await act(async () => { result = view.current.saveTask(4, value); });
  assert.equal(api.writes[0].method, 'update');
  await act(async () => { api.writes[0].reject(error); assert.equal(await result, false); });
  assert.equal(view.current.mutationError, error); assert.equal(view.current.error, null);
  assert.equal(view.current.pending, false); assert.deepEqual(view.current.snapshot, snapshot);
  assert.equal(api.reads.length, 1);
  await act(async () => { result = view.current.saveTask(4, value); });
  assert.equal(view.current.mutationError, null);
  await act(async () => { api.writes[1].resolve(task); await result; });
});
test('11. два синхронных вызова создают только одну мутацию', async () => {
  const api = fakeApi(), view = await mount(api); await ready(api, view); let first, second;
  await act(async () => { const save = view.current.saveTask; first = save(null, value); second = save(null, value); });
  assert.equal(api.writes.length, 1); assert.equal(await second, false);
  await act(async () => { api.writes[0].resolve(task); await first; });
});
test('12. успешная запись не становится ошибкой мутации при неуспешном GET', async () => {
  const api = fakeApi(), view = await mount(api); await ready(api, view); let result;
  await act(async () => { result = view.current.saveTask(null, value); });
  await act(async () => { api.writes[0].resolve(task); assert.equal(await result, true); });
  await act(async () => api.reads.at(-1).reject(new Error('Ошибка обновления')));
  assert.equal(view.current.status, 'error'); assert.equal(view.current.mutationError, null);
  assert.equal(api.writes.length, 1, 'POST не повторяется автоматически');
});
test('13. toggle, delete и reset используют соответствующие методы', async () => {
  const api = fakeApi(), view = await mount(api); await ready(api, view);
  for (const [invoke, method, args] of [
    [() => view.current.toggleTask(task), 'toggle', [4, true]],
    [() => view.current.deleteTask(4), 'delete', [4]],
    [() => view.current.resetData(), 'reset', []],
  ]) {
    let result; await act(async () => { result = invoke(); });
    const call = api.writes.at(-1); assert.equal(call.method, method);
    assert.deepEqual(call.args.slice(0, args.length), args);
    assert.equal(call.args.at(-1).signal.aborted, false);
    await act(async () => { call.resolve(null); assert.equal(await result, true); });
    await ready(api, view);
  }
});
test('14. размонтирование отменяет мутацию и не запускает новый GET', async () => {
  const api = fakeApi(), view = await mount(api); await ready(api, view); let result;
  await act(async () => { result = view.current.saveTask(null, value); });
  const signal = api.writes[0].args.at(-1).signal;
  await view.unmount(); assert.equal(signal.aborted, true);
  await act(async () => { api.writes[0].resolve(task); assert.equal(await result, false); });
  assert.equal(api.reads.length, 1);
});
test('15. смена фильтра во время мутации не отменяет запись; новый GET использует актуальный фильтр', async () => {
  const api = fakeApi(), view = await mount(api); await ready(api, view); let result;
  await act(async () => { result = view.current.saveTask(null, value); });
  const filters = { ...emptyFilters, completed: 'true' };
  await view.render(filters);
  assert.equal(api.writes[0].args.at(-1).signal.aborted, false);
  const during = api.reads.at(-1);
  await act(async () => { api.writes[0].resolve(task); await result; });
  assert.equal(during.signal.aborted, true);
  assert.deepEqual(api.reads.at(-1).filters, filters);
  await ready(api, view);
});
