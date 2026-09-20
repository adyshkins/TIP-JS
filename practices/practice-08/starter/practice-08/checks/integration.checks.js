// Интеграционные проверки клиента с локальным API ПР8.
import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";
import { ApiError, createApiClient } from "../src/api-client.js";
import { createTaskApi } from "../src/task-api.js";

let passed = 0;
let failed = 0;

async function check(name, action) {
  try {
    await action();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error.stack ?? error.message);
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}/api`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function expectApiError(action, kind, status = null) {
  let caught;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ApiError, "Ожидался ApiError");
  assert.equal(caught.kind, kind);
  if (status !== null) assert.equal(caught.status, status);
  return caught;
}

const server = createApiServer();
const baseUrl = await listen(server);
const client = createApiClient({ baseUrl, timeoutMs: 1000 });
const api = createTaskApi(client);

try {
  await check("01. начальная загрузка получает задачи и категории", async () => {
    const result = await api.loadInitialData({ completed: false });
    assert.deepEqual(result.tasks.map((task) => task.id), [4, 7, 13, 19, 22, 28, 34]);
    assert.deepEqual(result.categories.map((category) => category.id), [1, 2, 3]);
    assert.equal(result.meta.total, 7);
  });

  let createdId;
  await check("02. клиент создаёт задачу и получает назначенный id", async () => {
    const created = await api.createTask({
      title: "Интегрировать браузерный клиент",
      priority: "high",
      categoryId: 2,
    });
    createdId = created.id;
    assert.equal(created.id, 35);
    assert.equal(created.completed, false);
  });

  await check("03. созданная задача читается по id", async () => {
    const loaded = await api.getTaskById(createdId);
    assert.equal(loaded.title, "Интегрировать браузерный клиент");
    assert.equal(loaded.categoryId, 2);
  });

  await check("04. редактирование сохраняется на сервере", async () => {
    const updated = await api.updateTask(createdId, {
      title: "Проверить браузерный клиент",
      priority: "medium",
      categoryId: 1,
    });
    assert.equal(updated.title, "Проверить браузерный клиент");
    assert.equal(updated.priority, "medium");
    assert.equal(updated.completed, false);
    assert.deepEqual(await api.getTaskById(createdId), updated);
  });

  await check("05. созданная задача находится серверным поиском", async () => {
    const result = await api.getTasks({ q: "БРАУЗЕРНЫЙ", categoryId: 1 });
    assert.deepEqual(result.tasks.map((task) => task.id), [createdId]);
  });

  await check("06. смена статуса видна через фильтр", async () => {
    const updated = await api.setTaskCompleted(createdId, true);
    assert.equal(updated.completed, true);
    const result = await api.getTasks({ completed: true, q: "браузерный" });
    assert.deepEqual(result.tasks.map((task) => task.id), [createdId]);
  });

  await check("07. DELETE удаляет запись и возвращает null", async () => {
    assert.equal(await api.deleteTask(createdId), null);
    const result = await api.getTasks({ q: "браузерный" });
    assert.deepEqual(result.tasks, []);
  });

  await check("08. повторное удаление сохраняет код и детали 404", async () => {
    const error = await expectApiError(() => api.deleteTask(createdId), "http", 404);
    assert.equal(error.code, "TASK_NOT_FOUND");
    assert.deepEqual(error.details, { id: createdId });
  });

  await check("09. серверная ошибка валидации доступна клиенту", async () => {
    const error = await expectApiError(() => api.createTask({
      title: " ", priority: "urgent", categoryId: 99,
    }), "http", 400);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.ok(error.details.title);
    assert.ok(error.details.priority);
    assert.ok(error.details.categoryId);
  });

  await check("10. 204 не вызывает ошибку разбора JSON", async () => {
    const created = await api.createTask({ title: "Удалить без тела", priority: "low", categoryId: 3 });
    await assert.doesNotReject(() => api.deleteTask(created.id));
  });

  await check("11. реальная задержка прерывается по тайм-ауту", async () => {
    await expectApiError(() => client.requestJson("/debug/delay", {
      query: { ms: 150 }, timeoutMs: 15,
    }), "timeout");
  });

  await check("12. внешний AbortController отменяет реальный запрос", async () => {
    const controller = new AbortController();
    const pending = client.requestJson("/debug/delay", {
      query: { ms: 150 }, signal: controller.signal, timeoutMs: 1000,
    });
    controller.abort();
    await expectApiError(() => pending, "aborted");
  });

  await check("13. повреждённый JSON и text/plain определяются как invalid-response", async () => {
    await expectApiError(() => client.requestJson("/debug/invalid-json"), "invalid-response");
    await expectApiError(() => client.requestJson("/debug/text"), "invalid-response");
  });

  await check("14. reset восстанавливает исходный набор", async () => {
    const extra = await api.createTask({ title: "Временная", priority: "low", categoryId: 1 });
    assert.ok(extra.id >= 35);
    assert.deepEqual(await api.resetDemoData(), { reset: true, total: 12 });
    const result = await api.getTasks({});
    assert.deepEqual(result.tasks.map((task) => task.id), [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
  });
} finally {
  await close(server);
}

console.log(`\nИтог интеграции: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
