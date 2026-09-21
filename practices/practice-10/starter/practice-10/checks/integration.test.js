// HTTP-адаптеры ПР8 + настоящий собственный Express API; без браузера и React.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/http.js';
import { createApiClient } from './support/api-client.js';
import { createTaskApi } from './support/task-api.js';
const value = { title: 'Проверить интеграцию', priority: 'high', categoryId: 2 };
async function setup(t) {
  const { base } = await fixture(t);
  return createTaskApi(createApiClient({ baseUrl: base }));
}
test('Загрузка задач и категорий через адаптер ПР8', async t => {
  const api = await setup(t); const result = await api.loadInitialData();
  assert.equal(result.tasks.length, 12); assert.equal(result.categories.length, 3);
});
test('POST → GET → PATCH → GET → DELETE → GET', async t => {
  const api = await setup(t); const created = await api.createTask(value);
  assert.equal(created.id, 35);
  assert.deepEqual(await api.getTaskById(created.id), created);
  const updated = await api.updateTask(created.id, { title: 'Другое имя' });
  assert.equal(updated.title, 'Другое имя'); assert.equal(updated.categoryId, 2);
  await api.setTaskCompleted(created.id, true);
  assert.equal((await api.getTaskById(created.id)).completed, true);
  assert.equal(await api.deleteTask(created.id), null);
  await assert.rejects(api.getTaskById(created.id), e => e.kind === 'http' && e.status === 404 && e.code === 'TASK_NOT_FOUND');
});
test('false и комбинация фильтров проходят через транспорт', async t => {
  const api = await setup(t); const result = await api.getTasks({ completed: 'false', priority: 'high', categoryId: '2' });
  assert.deepEqual(result.tasks.map(t => t.id), [4, 34]);
});
test('После завершения созданная задача исчезает из выборки', async t => {
  const api = await setup(t); const created = await api.createTask(value);
  await api.setTaskCompleted(created.id, true);
  const result = await api.getTasks({ completed: 'false', priority: 'high', categoryId: '2' });
  assert.ok(!result.tasks.some(task => task.id === created.id));
});
test('Ошибки валидации сохраняют status/code/details на клиенте', async t => {
  const api = await setup(t);
  await assert.rejects(api.createTask({ ...value, title: ' ' }), e => e.kind === 'http' && e.status === 400 && e.code === 'VALIDATION_ERROR' && typeof e.details.title === 'string');
});
test('Повторная загрузка новым клиентом видит сохранённую запись', async t => {
  const { base } = await fixture(t);
  const a = createTaskApi(createApiClient({ baseUrl: base }));
  const b = createTaskApi(createApiClient({ baseUrl: base }));
  const created = await a.createTask(value);
  assert.deepEqual(await b.getTaskById(created.id), created);
});
test('Удаление из другой вкладки: PATCH возвращает 404', async t => {
  const api = await setup(t); await api.deleteTask(4);
  await assert.rejects(api.updateTask(4, { title: 'Черновик' }), e => e.status === 404 && e.code === 'TASK_NOT_FOUND');
});
test('Кнопка сброса ПР8 совместима с debug/reset', async t => {
  const api = await setup(t); await api.createTask(value);
  assert.deepEqual(await api.resetDemoData(), { reset: true, total: 12 });
  assert.equal((await api.getTasks()).tasks.length, 12);
});
