// Модульные проверки ПР6. Реальная сеть и настоящий DOM не используются.
import assert from "node:assert/strict";
import { ApiError, buildUrl, createApiClient } from "../src/api-client.js";
import { createAppController, messageForError } from "../src/app-controller.js";
import { validateTaskDraft } from "../src/form-validation.js";
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

function categories() {
  return [
    { id: 1, name: "Учёба" },
    { id: 2, name: "Проект" },
  ];
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

await check("01. buildUrl соединяет baseUrl, путь и кодированный query", () => {
  const result = new URL(buildUrl("http://127.0.0.1:5505/api/", "/tasks", {
    completed: false,
    q: "API & интерфейс",
    empty: "",
    missing: undefined,
  }));
  assert.equal(result.href, "http://127.0.0.1:5505/api/tasks?completed=false&q=API+%26+%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D1%84%D0%B5%D0%B9%D1%81");
});

await check("02. buildUrl не изменяет объект query", () => {
  const query = Object.freeze({ completed: false, q: "задача" });
  buildUrl("http://example.test/api", "/tasks", query);
  assert.deepEqual(query, { completed: false, q: "задача" });
});

await check("03. createApiClient проверяет конфигурацию", () => {
  for (const options of [
    {},
    { baseUrl: "/api" },
    { baseUrl: "ftp://example.test/api" },
    { baseUrl: "http://example.test/api?x=1" },
    { baseUrl: "http://example.test/api", fetchFn: null },
    { baseUrl: "http://example.test/api", timeoutMs: 0 },
  ]) assert.throws(() => createApiClient(options), TypeError);
});

await check("04. GET отправляет Accept, query и AbortSignal", async () => {
  let captured;
  const client = createApiClient({
    baseUrl: "http://example.test/api/",
    fetchFn: async (url, options) => {
      captured = { url: String(url), options };
      return jsonResponse({ data: [] });
    },
  });
  await client.requestJson("/tasks", { query: { completed: false } });
  assert.equal(captured.url, "http://example.test/api/tasks?completed=false");
  assert.equal(captured.options.method, "GET");
  assert.equal(new Headers(captured.options.headers).get("accept"), "application/json");
  assert.equal(new Headers(captured.options.headers).get("content-type"), null);
  assert.ok(captured.options.signal instanceof AbortSignal);
});

await check("05. POST сериализует тело и добавляет Content-Type", async () => {
  let captured;
  const draft = Object.freeze({ title: "Новая", priority: "low", categoryId: 1 });
  const client = createApiClient({
    baseUrl: "http://example.test/api",
    fetchFn: async (_url, options) => {
      captured = options;
      return jsonResponse({ data: task({ id: 35, title: "Новая", priority: "low", categoryId: 1 }) }, 201);
    },
  });
  await client.requestJson("/tasks", { method: "POST", body: draft });
  assert.equal(captured.method, "POST");
  assert.equal(new Headers(captured.headers).get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(captured.body), draft);
  assert.deepEqual(draft, { title: "Новая", priority: "low", categoryId: 1 });
});

await check("06. PATCH поддерживается, а неизвестный метод и body у GET отклоняются", async () => {
  const client = createApiClient({
    baseUrl: "http://example.test/api",
    fetchFn: async () => jsonResponse({ data: task() }),
  });
  await client.requestJson("/tasks/4", { method: "patch", body: { completed: true } });
  await assert.rejects(() => client.requestJson("/tasks", { method: "PUT" }), TypeError);
  await assert.rejects(() => client.requestJson("/tasks", { body: {} }), TypeError);
});

await check("07. успешный 204 преобразуется в null", async () => {
  const client = createApiClient({
    baseUrl: "http://example.test/api",
    fetchFn: async () => new Response(null, { status: 204 }),
  });
  assert.equal(await client.requestJson("/tasks/4", { method: "DELETE" }), null);
});

await check("08. JSON-ошибка HTTP сохраняет поля контракта", async () => {
  const client = createApiClient({
    baseUrl: "http://example.test/api",
    fetchFn: async () => jsonResponse({
      error: { code: "TASK_NOT_FOUND", message: "Задача не найдена.", details: { id: 999 } },
    }, 404),
  });
  const error = await expectApiError(() => client.requestJson("/tasks/999"), "http");
  assert.equal(error.status, 404);
  assert.equal(error.code, "TASK_NOT_FOUND");
  assert.deepEqual(error.details, { id: 999 });
  assert.equal(error.url, "http://example.test/api/tasks/999");
});

await check("09. HTTP-ошибка важнее неверного Content-Type", async () => {
  const client = createApiClient({
    baseUrl: "http://example.test/api",
    fetchFn: async () => new Response("Bad gateway", { status: 502, headers: { "Content-Type": "text/plain" } }),
  });
  const error = await expectApiError(() => client.requestJson("/tasks"), "http");
  assert.equal(error.status, 502);
});

await check("10. неверный Content-Type и повреждённый JSON отклоняются", async () => {
  for (const response of [
    new Response("text", { status: 200, headers: { "Content-Type": "text/plain" } }),
    new Response("{broken", { status: 200, headers: { "Content-Type": "application/json" } }),
  ]) {
    const client = createApiClient({ baseUrl: "http://example.test/api", fetchFn: async () => response });
    await expectApiError(() => client.requestJson("/tasks"), "invalid-response");
  }
});

await check("11. сетевая ошибка сохраняется как cause", async () => {
  const source = new TypeError("fetch failed");
  const client = createApiClient({
    baseUrl: "http://example.test/api",
    fetchFn: async () => { throw source; },
  });
  const error = await expectApiError(() => client.requestJson("/tasks"), "network");
  assert.equal(error.cause, source);
});

function abortableFetch(_url, { signal }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(jsonResponse({ data: [] })), 2000);
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
  });
}

await check("12. тайм-аут отличается от внешней отмены", async () => {
  const client = createApiClient({ baseUrl: "http://example.test/api", fetchFn: abortableFetch, timeoutMs: 15 });
  await expectApiError(() => client.requestJson("/slow"), "timeout");
  const controller = new AbortController();
  const pending = client.requestJson("/slow", { signal: controller.signal, timeoutMs: 1000 });
  controller.abort();
  await expectApiError(() => pending, "aborted");
});

await check("13. createTaskApi требует requestJson", () => {
  for (const value of [undefined, {}, { requestJson: 1 }]) assert.throws(() => createTaskApi(value), TypeError);
});

await check("14. getTasks нормализует фильтры и проверяет ответ", async () => {
  const calls = [];
  const api = createTaskApi({
    async requestJson(path, options) {
      calls.push({ path, options });
      return { data: [task()], meta: { total: 1, filters: options.query } };
    },
  });
  const result = await api.getTasks({ completed: false, priority: "high", categoryId: 2, q: "  модель  " });
  assert.deepEqual(calls[0].path, "/tasks");
  assert.deepEqual(calls[0].options.query, { completed: false, priority: "high", categoryId: 2, q: "модель" });
  assert.deepEqual(result.tasks, [task()]);
});

await check("15. getTasks отклоняет неверные фильтры до запроса", async () => {
  let calls = 0;
  const api = createTaskApi({ requestJson: async () => { calls += 1; } });
  for (const filters of [{ completed: "false" }, { priority: "urgent" }, { categoryId: 0 }, { q: "x".repeat(101) }, { owner: 1 }]) {
    await assert.rejects(() => api.getTasks(filters), TypeError);
  }
  assert.equal(calls, 0);
});

await check("16. loadInitialData параллельно запрашивает задачи и категории", async () => {
  const started = [];
  const api = createTaskApi({
    async requestJson(path) {
      started.push(path);
      await Promise.resolve();
      return path === "/tasks"
        ? { data: [task()], meta: { total: 1, filters: {} } }
        : { data: categories(), meta: { total: 2 } };
    },
  });
  const result = await api.loadInitialData({});
  assert.deepEqual(started, ["/tasks", "/categories"]);
  assert.deepEqual(result.categories, categories());
  assert.equal(result.meta.total, 1);
});

await check("17. createTask отправляет POST и проверяет задачу", async () => {
  let captured;
  const created = task({ id: 35, title: "Новая" });
  const api = createTaskApi({
    async requestJson(path, options) {
      captured = { path, options };
      return { data: created };
    },
  });
  assert.deepEqual(await api.createTask({ title: "Новая", priority: "high", categoryId: 2 }), created);
  assert.equal(captured.path, "/tasks");
  assert.equal(captured.options.method, "POST");
  assert.deepEqual(captured.options.body, { title: "Новая", priority: "high", categoryId: 2 });
});

await check("18. update и смена статуса отправляют PATCH", async () => {
  const calls = [];
  const api = createTaskApi({
    async requestJson(path, options) {
      calls.push({ path, options });
      return { data: task({ ...options.body }) };
    },
  });
  await api.updateTask(4, { title: "Изменено", priority: "low", categoryId: 1 });
  await api.setTaskCompleted(4, true);
  assert.deepEqual(calls.map((call) => [call.path, call.options.method, call.options.body]), [
    ["/tasks/4", "PATCH", { title: "Изменено", priority: "low", categoryId: 1 }],
    ["/tasks/4", "PATCH", { completed: true }],
  ]);
});

await check("19. deleteTask требует ответ 204, reset проверяет подтверждение", async () => {
  const calls = [];
  const api = createTaskApi({
    async requestJson(path, options) {
      calls.push({ path, options });
      if (path === "/debug/reset") return { data: { reset: true, total: 12 } };
      return null;
    },
  });
  assert.equal(await api.deleteTask(4), null);
  assert.deepEqual(await api.resetDemoData(), { reset: true, total: 12 });
  assert.deepEqual(calls.map((call) => [call.path, call.options.method]), [
    ["/tasks/4", "DELETE"], ["/debug/reset", "POST"],
  ]);
});

await check("20. доменный API отклоняет неверную схему ответа", async () => {
  const api = createTaskApi({ requestJson: async () => ({ data: [{ id: 1, title: "Ошибка" }], meta: { total: 1 } }) });
  await expectApiError(() => api.getTasks({}), "invalid-response");
});

await check("21. validateTaskDraft нормализует корректные данные", () => {
  const result = validateTaskDraft({ title: "  Новая задача  ", priority: "low", categoryId: "2" }, categories());
  assert.deepEqual(result, {
    valid: true,
    value: { title: "Новая задача", priority: "low", categoryId: 2 },
    errors: {},
  });
});

await check("22. validateTaskDraft возвращает ошибки каждого поля", () => {
  const result = validateTaskDraft({ title: "   ", priority: "urgent", categoryId: "99" }, categories());
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ["categoryId", "priority", "title"]);
});

function createViewDouble() {
  return {
    states: [], tasks: [], categories: [], totals: [], formTasks: [], errors: [], pending: [], notices: [],
    setListState(...args) { this.states.push(args); },
    setTasks(...args) { this.tasks.push(args); },
    setCategories(value) { this.categories.push(value); },
    setTotal(value) { this.totals.push(value); },
    setFormTask(value) { this.formTasks.push(value); },
    showFormErrors(value) { this.errors.push(value); },
    setMutationPending(value) { this.pending.push(value); },
    notify(...args) { this.notices.push(args); },
  };
}

function createApiDouble(overrides = {}) {
  const list = [task()];
  const cats = categories();
  return {
    async loadInitialData() { return { tasks: list, categories: cats, meta: { total: 1, filters: {} } }; },
    async getTasks() { return { tasks: list, meta: { total: 1, filters: {} } }; },
    async createTask(draft) { return task({ id: 35, ...draft }); },
    async updateTask(id, changes) { return task({ id, ...changes }); },
    async setTaskCompleted(id, completed) { return task({ id, completed }); },
    async deleteTask() { return null; },
    async resetDemoData() { return { reset: true, total: 12 }; },
    ...overrides,
  };
}

await check("23. контроллер проверяет зависимости", () => {
  assert.throws(() => createAppController(), TypeError);
  assert.throws(() => createAppController({ api: {}, view: {} }), TypeError);
});

await check("24. start отображает loading, категории, задачи и ready", async () => {
  const view = createViewDouble();
  const controller = createAppController({ api: createApiDouble(), view });
  await controller.start({ completed: false });
  assert.equal(view.states[0][0], "loading");
  assert.equal(view.states.at(-1)[0], "ready");
  assert.deepEqual(view.categories.at(-1), categories());
  assert.deepEqual(view.tasks.at(-1)[0], [task()]);
  assert.equal(view.totals.at(-1), 1);
});

await check("25. пустой ответ отображает состояние empty", async () => {
  const view = createViewDouble();
  const api = createApiDouble({
    async loadInitialData() { return { tasks: [], categories: categories(), meta: { total: 0, filters: {} } }; },
  });
  await createAppController({ api, view }).start({});
  assert.equal(view.states.at(-1)[0], "empty");
  assert.equal(view.totals.at(-1), 0);
});

await check("26. ошибка загрузки отображается, а aborted не показывается", async () => {
  const view = createViewDouble();
  let attempts = 0;
  const api = createApiDouble({
    async loadInitialData() {
      attempts += 1;
      if (attempts === 1) throw new ApiError("offline", { kind: "network" });
      return { tasks: [task()], categories: categories(), meta: { total: 1, filters: {} } };
    },
    async getTasks() { throw new Error("До загрузки категорий нужен loadInitialData"); },
  });
  const controller = createAppController({ api, view });
  await controller.start({});
  assert.equal(view.states.at(-1)[0], "error");
  assert.match(view.states.at(-1)[1], /соединения/i);
  await controller.refresh();
  assert.equal(attempts, 2);
  assert.deepEqual(view.categories.at(-1), categories());
  assert.equal(view.states.at(-1)[0], "ready");

  const quietView = createViewDouble();
  const quietApi = createApiDouble({
    async loadInitialData() { throw new ApiError("cancel", { kind: "aborted" }); },
  });
  await createAppController({ api: quietApi, view: quietView }).start({});
  assert.equal(quietView.states.some(([kind]) => kind === "error"), false);
});

await check("27. новая загрузка отменяет предыдущую и игнорирует устаревший ответ", async () => {
  const view = createViewDouble();
  let resolveFirst;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  let firstSignal;
  let initialCalls = 0;
  const api = createApiDouble({
    loadInitialData(filters, { signal }) {
      initialCalls += 1;
      if (initialCalls === 1) {
        firstSignal = signal;
        return first;
      }
      return Promise.resolve({
        tasks: [task({ id: 7, title: filters.q })],
        categories: categories(),
        meta: { total: 1, filters },
      });
    },
    async getTasks() { throw new Error("До загрузки категорий нужен loadInitialData"); },
  });
  const controller = createAppController({ api, view });
  const pending = controller.start({});
  await controller.applyFilters({ q: "новый" });
  assert.equal(firstSignal.aborted, true);
  resolveFirst({ tasks: [task({ id: 1, title: "старый" })], categories: categories(), meta: { total: 1 } });
  await pending;
  assert.equal(view.tasks.at(-1)[0][0].title, "новый");
});

await check("28. невалидная форма не вызывает API", async () => {
  const view = createViewDouble();
  let calls = 0;
  const api = createApiDouble({ async createTask() { calls += 1; } });
  const controller = createAppController({ api, view });
  await controller.start({});
  await controller.submit({ title: " ", priority: "urgent", categoryId: "99" });
  assert.equal(calls, 0);
  assert.ok(view.errors.at(-1).title);
});

await check("29. создание блокирует действия, очищает форму и обновляет список", async () => {
  const view = createViewDouble();
  let created;
  let loads = 0;
  const api = createApiDouble({
    async createTask(draft) { created = draft; return task({ id: 35, ...draft }); },
    async getTasks() { loads += 1; return { tasks: [task()], meta: { total: 1 } }; },
  });
  const controller = createAppController({ api, view });
  await controller.start({});
  await controller.submit({ title: "  Клиент  ", priority: "medium", categoryId: "1" });
  assert.deepEqual(created, { title: "Клиент", priority: "medium", categoryId: 1 });
  assert.deepEqual(view.pending.slice(-2), [true, false]);
  assert.equal(view.formTasks.at(-1), null);
  assert.equal(loads, 1);
  assert.equal(view.notices.at(-1)[1], "success");
});

await check("30. редактирование, toggle и delete используют id текущей задачи", async () => {
  const view = createViewDouble();
  const calls = [];
  const api = createApiDouble({
    async updateTask(id, changes) { calls.push(["update", id, changes]); return task({ id, ...changes }); },
    async setTaskCompleted(id, value) { calls.push(["toggle", id, value]); return task({ id, completed: value }); },
    async deleteTask(id) { calls.push(["delete", id]); return null; },
  });
  const controller = createAppController({ api, view });
  await controller.start({});
  controller.beginEdit(4);
  assert.equal(view.formTasks.at(-1).id, 4);
  await controller.submit({ title: "Изменено", priority: "low", categoryId: "1" });
  await controller.toggleTask(4);
  await controller.deleteTask(4);
  assert.deepEqual(calls, [
    ["update", 4, { title: "Изменено", priority: "low", categoryId: 1 }],
    ["toggle", 4, true],
    ["delete", 4],
  ]);
});

await check("31. ошибка мутации показывается и снимает блокировку", async () => {
  const view = createViewDouble();
  const api = createApiDouble({
    async deleteTask() { throw new ApiError("Сервис недоступен.", { kind: "http", status: 503 }); },
  });
  const controller = createAppController({ api, view });
  await controller.start({});
  await controller.deleteTask(4);
  assert.deepEqual(view.pending.slice(-2), [true, false]);
  assert.equal(view.notices.at(-1)[1], "error");
  assert.match(view.notices.at(-1)[0], /недоступен/i);
});

await check("32. reset вызывает сервер и перезагружает текущий фильтр", async () => {
  const view = createViewDouble();
  const seen = [];
  const api = createApiDouble({
    async resetDemoData() { seen.push("reset"); return { reset: true, total: 12 }; },
    async getTasks(filters) { seen.push(filters); return { tasks: [task()], meta: { total: 1, filters } }; },
  });
  const controller = createAppController({ api, view });
  await controller.start({ priority: "high" });
  await controller.resetData();
  assert.deepEqual(seen, ["reset", { priority: "high" }]);
});

await check("33. messageForError не раскрывает внутреннюю ошибку", () => {
  assert.equal(messageForError(new Error("пароль=secret")), "Не удалось выполнить операцию.");
  assert.match(messageForError(new ApiError("x", { kind: "timeout" })), /вовремя/i);
});

console.log(`\nИтог модулей: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
