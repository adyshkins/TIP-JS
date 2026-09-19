// Модульные проверки API-клиента ПР5. Реальная сеть не используется.
import assert from "node:assert/strict";
import { ApiError, buildUrl, createApiClient } from "../src/api-client.js";
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

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function task(overrides = {}) {
  return {
    id: 4,
    title: "Подготовить модель задач",
    completed: false,
    priority: "high",
    categoryId: 2,
    ...overrides,
  };
}

function category(overrides = {}) {
  return { id: 2, name: "Проект", ...overrides };
}

async function expectApiError(action, kind) {
  let caught;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ApiError, "Ожидался экземпляр ApiError");
  assert.equal(caught.kind, kind);
  return caught;
}

await check("01. buildUrl соединяет baseUrl и путь без двойного слеша", () => {
  assert.equal(
    buildUrl("http://127.0.0.1:5505/api/", "/tasks"),
    "http://127.0.0.1:5505/api/tasks",
  );
});

await check("02. buildUrl кодирует параметры и сохраняет false и 0", () => {
  const result = new URL(buildUrl("http://localhost:5505/api", "tasks", {
    completed: false,
    categoryId: 0,
    q: "API & ошибки",
    empty: "",
    missing: undefined,
    none: null,
  }));
  assert.equal(result.searchParams.get("completed"), "false");
  assert.equal(result.searchParams.get("categoryId"), "0");
  assert.equal(result.searchParams.get("q"), "API & ошибки");
  assert.equal(result.searchParams.has("empty"), false);
  assert.equal(result.searchParams.has("missing"), false);
  assert.equal(result.searchParams.has("none"), false);
});

await check("03. buildUrl не изменяет входной объект query", () => {
  const query = Object.freeze({ completed: false, q: "задача" });
  buildUrl("http://localhost:5505/api", "/tasks", query);
  assert.deepEqual(query, { completed: false, q: "задача" });
});

await check("04. createApiClient проверяет конфигурацию", () => {
  const invalid = [
    {},
    { baseUrl: "/api" },
    { baseUrl: "ftp://example.test/api" },
    { baseUrl: "http://example.test/api?x=1" },
    { baseUrl: "http://example.test/api", fetchFn: null },
    { baseUrl: "http://example.test/api", timeoutMs: 0 },
    { baseUrl: "http://example.test/api", timeoutMs: 1.5 },
  ];
  for (const options of invalid) {
    assert.throws(() => createApiClient(options), TypeError);
  }
});

await check("05. requestJson выполняет GET с Accept и signal", async () => {
  let captured;
  const fetchFn = async (url, options) => {
    captured = { url: String(url), options };
    return jsonResponse({ data: [task()] });
  };
  const client = createApiClient({
    baseUrl: "http://example.test/api/",
    fetchFn,
    timeoutMs: 500,
  });
  await client.requestJson("/tasks", { query: { completed: false } });
  assert.equal(captured.url, "http://example.test/api/tasks?completed=false");
  assert.equal(captured.options.method, "GET");
  assert.ok(captured.options.signal instanceof AbortSignal);
  assert.equal(new Headers(captured.options.headers).get("accept"), "application/json");
});

await check("06. requestJson возвращает разобранный JSON успешного ответа", async () => {
  const payload = { data: [task()] };
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => jsonResponse(payload),
  });
  assert.deepEqual(await client.requestJson("/tasks"), payload);
});

await check("07. успешный ответ 204 преобразуется в null", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response(null, { status: 204 }),
  });
  assert.equal(await client.requestJson("/empty"), null);
});

await check("08. JSON-ошибка 404 преобразуется в ApiError с полями контракта", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => jsonResponse({
      error: {
        code: "TASK_NOT_FOUND",
        message: "Задача не найдена.",
        details: { id: 999 },
      },
    }, 404),
  });
  const error = await expectApiError(() => client.requestJson("/tasks/999"), "http");
  assert.equal(error.status, 404);
  assert.equal(error.code, "TASK_NOT_FOUND");
  assert.deepEqual(error.details, { id: 999 });
  assert.equal(error.message, "Задача не найдена.");
  assert.equal(error.url, "https://example.test/api/tasks/999");
});

await check("09. HTTP-ошибка без JSON сохраняет приоритет статуса", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response("<h1>Ошибка</h1>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    }),
  });
  const error = await expectApiError(() => client.requestJson("/tasks"), "http");
  assert.equal(error.status, 502);
  assert.match(error.message, /502/);
});

await check("10. успешный ответ с неверным Content-Type отклоняется", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response("обычный текст", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    }),
  });
  await expectApiError(() => client.requestJson("/tasks"), "invalid-response");
});

await check("11. повреждённый JSON успешного ответа отклоняется", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response("{broken", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  });
  const error = await expectApiError(
    () => client.requestJson("/tasks"),
    "invalid-response",
  );
  assert.ok(error.cause instanceof SyntaxError);
});

await check("12. значение вместо Response отклоняется как неверный ответ", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => ({ status: 200, ok: true }),
  });
  await expectApiError(() => client.requestJson("/tasks"), "invalid-response");
});

await check("13. сетевая ошибка преобразуется и сохраняется как cause", async () => {
  const source = new TypeError("fetch failed");
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => {
      throw source;
    },
  });
  const error = await expectApiError(() => client.requestJson("/tasks"), "network");
  assert.equal(error.cause, source);
});

await check("14. превышение времени запроса имеет kind timeout", async () => {
  const fetchFn = (_url, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(
      () => resolve(jsonResponse({ data: null })),
      2000,
    );
    if (signal.aborted) {
      clearTimeout(keepAlive);
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(signal.reason);
    }, { once: true });
  });
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn,
    timeoutMs: 20,
  });
  const error = await expectApiError(() => client.requestJson("/slow"), "timeout");
  assert.match(error.message, /врем/i);
});

await check("15. внешний AbortSignal отличает отмену от тайм-аута", async () => {
  const fetchFn = (_url, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(
      () => resolve(jsonResponse({ data: null })),
      2000,
    );
    if (signal.aborted) {
      clearTimeout(keepAlive);
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(signal.reason);
    }, { once: true });
  });
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn,
    timeoutMs: 1000,
  });
  const controller = new AbortController();
  const pending = client.requestJson("/slow", { signal: controller.signal });
  controller.abort();
  await expectApiError(() => pending, "aborted");
});

await check("16. ApiError от обработки ответа не маскируется как network", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => jsonResponse({
      error: { code: "SERVICE_UNAVAILABLE", message: "Недоступно." },
    }, 503),
  });
  const error = await expectApiError(() => client.requestJson("/tasks"), "http");
  assert.equal(error.status, 503);
});

await check("17. createTaskApi требует requestJson", () => {
  assert.throws(() => createTaskApi(), TypeError);
  assert.throws(() => createTaskApi({}), TypeError);
  assert.throws(() => createTaskApi({ requestJson: 1 }), TypeError);
});

await check("18. getTasks нормализует допустимые фильтры", async () => {
  const calls = [];
  const client = {
    async requestJson(path, options) {
      calls.push({ path, options });
      return {
        data: [task()],
        meta: {
          total: 1,
          filters: {
            completed: false,
            priority: "high",
            categoryId: 2,
            q: "клиент",
          },
        },
      };
    },
  };
  const api = createTaskApi(client);
  const result = await api.getTasks({
    completed: false,
    priority: "high",
    categoryId: 2,
    q: "  клиент  ",
  });
  assert.deepEqual(calls, [{
    path: "/tasks",
    options: {
      query: {
        completed: false,
        priority: "high",
        categoryId: 2,
        q: "клиент",
      },
    },
  }]);
  assert.deepEqual(result.tasks, [task()]);
  assert.equal(result.meta.total, 1);
});

await check("19. getTasks отклоняет неверные и неизвестные фильтры до запроса", async () => {
  let calls = 0;
  const api = createTaskApi({
    async requestJson() {
      calls += 1;
      return {};
    },
  });
  const invalid = [
    null,
    [],
    { completed: "false" },
    { priority: "urgent" },
    { categoryId: 0 },
    { categoryId: "2" },
    { q: 10 },
    { q: "x".repeat(101) },
    { unknown: true },
  ];
  for (const filters of invalid) {
    await assert.rejects(() => api.getTasks(filters), TypeError);
  }
  assert.equal(calls, 0);
});

await check("20. getTaskById проверяет id и путь", async () => {
  const calls = [];
  const api = createTaskApi({
    async requestJson(path, options) {
      calls.push({ path, options });
      return { data: task() };
    },
  });
  assert.deepEqual(await api.getTaskById(4), task());
  assert.deepEqual(calls, [{ path: "/tasks/4", options: undefined }]);
  for (const id of [0, -1, 1.5, "4", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(() => api.getTaskById(id), TypeError);
  }
  assert.equal(calls.length, 1);
});

await check("21. getCategories возвращает проверенный массив", async () => {
  const api = createTaskApi({
    async requestJson(path, options) {
      assert.equal(path, "/categories");
      assert.equal(options, undefined);
      return { data: [category()], meta: { total: 1 } };
    },
  });
  assert.deepEqual(await api.getCategories(), [category()]);
});

await check("22. ответы задач проверяются по схеме", async () => {
  const invalidTasks = [
    task({ id: 0 }),
    task({ title: "   " }),
    task({ completed: "false" }),
    task({ priority: "urgent" }),
    task({ categoryId: null }),
  ];
  for (const invalidTask of invalidTasks) {
    const api = createTaskApi({
      async requestJson() {
        return { data: [invalidTask], meta: { total: 1, filters: {} } };
      },
    });
    await expectApiError(() => api.getTasks(), "invalid-response");
  }
});

await check("23. коллекция задач отклоняет повторяющиеся id и неверный meta.total", async () => {
  for (const payload of [
    { data: [task(), task()], meta: { total: 2, filters: {} } },
    { data: [task()], meta: { total: 2, filters: {} } },
    { data: "не массив", meta: { total: 1, filters: {} } },
  ]) {
    const api = createTaskApi({ async requestJson() { return payload; } });
    await expectApiError(() => api.getTasks(), "invalid-response");
  }
});

await check("24. одиночная задача и категории проверяются по схеме", async () => {
  const invalidTaskApi = createTaskApi({
    async requestJson() {
      return { data: task({ id: "4" }) };
    },
  });
  await expectApiError(() => invalidTaskApi.getTaskById(4), "invalid-response");

  const invalidCategoryApi = createTaskApi({
    async requestJson() {
      return { data: [category({ name: "" })], meta: { total: 1 } };
    },
  });
  await expectApiError(() => invalidCategoryApi.getCategories(), "invalid-response");
});

await check("25. loadInitialData начинает два независимых запроса параллельно", async () => {
  const calls = [];
  const resolvers = new Map();
  const client = {
    requestJson(path) {
      calls.push(path);
      return new Promise((resolve) => resolvers.set(path, resolve));
    },
  };
  const api = createTaskApi(client);
  const pending = api.loadInitialData({ completed: false });
  await Promise.resolve();
  assert.deepEqual(calls, ["/tasks", "/categories"]);

  resolvers.get("/tasks")({
    data: [task()],
    meta: { total: 1, filters: { completed: false } },
  });
  resolvers.get("/categories")({
    data: [category()],
    meta: { total: 1 },
  });
  assert.deepEqual(await pending, {
    tasks: [task()],
    categories: [category()],
    meta: { total: 1, filters: { completed: false } },
  });
});

await check("26. loadInitialData передаёт отказ одного из запросов вызывающему коду", async () => {
  const source = new ApiError("Нет связи.", { kind: "network" });
  const api = createTaskApi({
    async requestJson(path) {
      if (path === "/tasks") throw source;
      return { data: [category()], meta: { total: 1 } };
    },
  });
  await assert.rejects(() => api.loadInitialData(), (error) => error === source);
});

console.log(`\nИтог клиента: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
