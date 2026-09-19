// Интеграционные проверки: готовый API и реализованный студентом клиент.
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
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function expectApiError(action, kind, status = null) {
  let caught;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ApiError, "Ожидался экземпляр ApiError");
  assert.equal(caught.kind, kind);
  if (status !== null) assert.equal(caught.status, status);
  return caught;
}

const server = createApiServer();
const baseUrl = await listen(server);
const client = createApiClient({ baseUrl, timeoutMs: 1000 });
const api = createTaskApi(client);

try {
  await check("01. клиент получает полный список от реального API", async () => {
    const result = await api.getTasks();
    assert.equal(result.tasks.length, 12);
    assert.deepEqual(result.tasks.map((task) => task.id), [
      1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34,
    ]);
    assert.equal(result.meta.total, 12);
  });

  await check("02. логические false и несколько фильтров доходят до API", async () => {
    const result = await api.getTasks({
      completed: false,
      priority: "high",
      categoryId: 2,
    });
    assert.deepEqual(result.tasks.map((task) => task.id), [4, 34]);
    assert.deepEqual(result.meta.filters, {
      completed: false,
      priority: "high",
      categoryId: 2,
      q: "",
    });
  });

  await check("03. строка поиска кодируется и обрабатывается", async () => {
    const result = await api.getTasks({ q: "провер" });
    assert.deepEqual(result.tasks.map((task) => task.id), [7, 16]);
  });

  await check("04. клиент получает одну задачу", async () => {
    const task = await api.getTaskById(25);
    assert.equal(task.title, "Исправить обработку ошибок");
    assert.equal(task.categoryId, 2);
  });

  await check("05. клиент получает категории", async () => {
    const categories = await api.getCategories();
    assert.deepEqual(categories.map((item) => item.id), [1, 2, 3]);
  });

  await check("06. параллельная начальная загрузка собирает общий результат", async () => {
    const result = await api.loadInitialData({ completed: true });
    assert.deepEqual(result.tasks.map((task) => task.id), [1, 10, 16, 25, 31]);
    assert.equal(result.categories.length, 3);
    assert.equal(result.meta.total, 5);
  });

  await check("07. ошибка 404 сохраняет код и детали API", async () => {
    const error = await expectApiError(() => api.getTaskById(999), "http", 404);
    assert.equal(error.code, "TASK_NOT_FOUND");
    assert.deepEqual(error.details, { id: 999 });
  });

  await check("08. ошибка запроса 400 не считается сетевой", async () => {
    const error = await expectApiError(
      () => client.requestJson("/tasks", { query: { completed: "yes" } }),
      "http",
      400,
    );
    assert.equal(error.code, "INVALID_QUERY");
  });

  await check("09. ошибка сервера 503 сохраняет вид http", async () => {
    const error = await expectApiError(
      () => client.requestJson("/debug/error"),
      "http",
      503,
    );
    assert.equal(error.code, "SERVICE_UNAVAILABLE");
  });

  await check("10. повреждённый JSON определяется как invalid-response", async () => {
    await expectApiError(
      () => client.requestJson("/debug/invalid-json"),
      "invalid-response",
    );
  });

  await check("11. неожиданный Content-Type определяется как invalid-response", async () => {
    await expectApiError(() => client.requestJson("/debug/text"), "invalid-response");
  });

  await check("12. медленный ответ прерывается по тайм-ауту", async () => {
    await expectApiError(
      () => client.requestJson("/debug/delay", {
        query: { ms: 150 },
        timeoutMs: 20,
      }),
      "timeout",
    );
  });

  await check("13. внешний AbortController отменяет реальный запрос", async () => {
    const controller = new AbortController();
    const pending = client.requestJson("/debug/delay", {
      query: { ms: 150 },
      signal: controller.signal,
      timeoutMs: 1000,
    });
    controller.abort();
    await expectApiError(() => pending, "aborted");
  });
} finally {
  await close(server);
}

console.log(`\nИтог интеграции: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
