// Готовый локальный API для ПР8. Реализация сервера относится к ПР9–ПР10.
// Данные хранятся в памяти и восстанавливаются после перезапуска или debug/reset.
import http from "node:http";
import { pathToFileURL } from "node:url";
import { categories as seedCategories, tasks as seedTasks } from "./data.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5505;
const MAX_BODY_BYTES = 16 * 1024;
const PRIORITIES = new Set(["low", "medium", "high"]);
const FILTER_NAMES = new Set(["completed", "priority", "categoryId", "q"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Expose-Headers": "Location",
    "Access-Control-Max-Age": "600",
  };
}

function sendJson(res, status, payload, head = false, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(),
    ...extraHeaders,
  });
  res.end(head ? undefined : body);
}

function sendEmpty(res, status, extraHeaders = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...corsHeaders(),
    ...extraHeaders,
  });
  res.end();
}

function sendRaw(res, status, body, contentType, head = false) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(),
  });
  res.end(head ? undefined : body);
}

function sendError(res, status, code, message, details, head = false, headers = {}) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  sendJson(res, status, { error }, head, headers);
}

function oneValue(searchParams, name) {
  const values = searchParams.getAll(name);
  if (values.length > 1) throw new TypeError(`Параметр ${name} нельзя повторять.`);
  return values[0] ?? null;
}

function parsePositiveId(raw) {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function parseFilters(searchParams) {
  for (const name of searchParams.keys()) {
    if (!FILTER_NAMES.has(name)) throw new TypeError(`Неизвестный параметр запроса: ${name}.`);
  }

  const filters = { completed: null, priority: null, categoryId: null, q: "" };
  const completed = oneValue(searchParams, "completed");
  if (completed !== null) {
    if (!["true", "false"].includes(completed)) {
      throw new TypeError("completed должен быть true или false.");
    }
    filters.completed = completed === "true";
  }

  const priority = oneValue(searchParams, "priority");
  if (priority !== null) {
    if (!PRIORITIES.has(priority)) throw new TypeError("priority должен быть low, medium или high.");
    filters.priority = priority;
  }

  const categoryId = oneValue(searchParams, "categoryId");
  if (categoryId !== null) {
    const parsed = parsePositiveId(categoryId);
    if (parsed === null) throw new TypeError("categoryId должен быть положительным целым числом.");
    filters.categoryId = parsed;
  }

  const q = oneValue(searchParams, "q");
  if (q !== null) {
    filters.q = q.trim();
    if (filters.q.length > 100) throw new TypeError("q не должен быть длиннее 100 символов.");
  }
  return filters;
}

function selectTasks(tasks, filters) {
  const needle = filters.q.toLocaleLowerCase("ru-RU");
  return tasks.filter((task) => {
    if (filters.completed !== null && task.completed !== filters.completed) return false;
    if (filters.priority !== null && task.priority !== filters.priority) return false;
    if (filters.categoryId !== null && task.categoryId !== filters.categoryId) return false;
    return !needle || task.title.toLocaleLowerCase("ru-RU").includes(needle);
  });
}

function parseDelay(searchParams) {
  for (const name of searchParams.keys()) {
    if (name !== "ms") throw new TypeError(`Неизвестный параметр запроса: ${name}.`);
  }
  const raw = oneValue(searchParams, "ms") ?? "1000";
  if (!/^\d+$/.test(raw)) throw new TypeError("ms должен быть целым числом от 0 до 5000.");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > 5000) {
    throw new TypeError("ms должен быть целым числом от 0 до 5000.");
  }
  return value;
}

function validateTaskFields(value, { partial = false, categoryIds } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { body: "Тело запроса должно быть JSON-объектом." };
  }

  const allowed = partial
    ? new Set(["title", "completed", "priority", "categoryId"])
    : new Set(["title", "priority", "categoryId"]);
  const errors = {};
  for (const name of Object.keys(value)) {
    if (!allowed.has(name)) errors[name] = "Неизвестное поле.";
  }

  if (partial && Object.keys(value).length === 0) errors.body = "Нужно передать хотя бы одно поле.";
  for (const name of ["title", "priority", "categoryId"]) {
    if (!partial && !(name in value)) errors[name] = "Обязательное поле.";
  }

  if ("title" in value) {
    if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.trim().length > 100) {
      errors.title = "Название должно содержать от 1 до 100 символов.";
    }
  }
  if ("completed" in value && typeof value.completed !== "boolean") {
    errors.completed = "completed должен быть логическим значением.";
  }
  if ("priority" in value && !PRIORITIES.has(value.priority)) {
    errors.priority = "Приоритет должен быть low, medium или high.";
  }
  if ("categoryId" in value
      && (!Number.isSafeInteger(value.categoryId) || !categoryIds.has(value.categoryId))) {
    errors.categoryId = "Указана неизвестная категория.";
  }
  return errors;
}

async function readJsonBody(req) {
  const contentType = req.headers["content-type"] ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    const error = new Error("Тело запроса должно иметь Content-Type application/json.");
    error.status = 415;
    error.code = "UNSUPPORTED_MEDIA_TYPE";
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Тело запроса слишком велико.");
      error.status = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Тело запроса содержит некорректный JSON.");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function createApiServer() {
  let tasks = seedTasks.map((task) => ({ ...task }));
  const categories = seedCategories.map((category) => ({ ...category }));
  const categoryIds = new Set(categories.map((category) => category.id));
  let nextId = Math.max(...tasks.map((task) => task.id)) + 1;

  function resetState() {
    tasks = seedTasks.map((task) => ({ ...task }));
    nextId = Math.max(...tasks.map((task) => task.id)) + 1;
  }

  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url ?? "/", `http://${HOST}`);
    } catch {
      sendError(res, 400, "BAD_REQUEST", "Не удалось разобрать адрес запроса.");
      return;
    }

    if (req.method === "OPTIONS") {
      sendEmpty(res, 204);
      return;
    }

    const head = req.method === "HEAD";
    const method = head ? "GET" : req.method;
    try {
      if (method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { data: { status: "ok" } }, head);
        return;
      }

      if (method === "GET" && url.pathname === "/api/tasks") {
        const filters = parseFilters(url.searchParams);
        const selected = selectTasks(tasks, filters);
        sendJson(res, 200, { data: selected, meta: { total: selected.length, filters } }, head);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/tasks") {
        const body = await readJsonBody(req);
        const details = validateTaskFields(body, { categoryIds });
        if (Object.keys(details).length > 0) {
          sendError(res, 400, "VALIDATION_ERROR", "Данные задачи не прошли проверку.", details);
          return;
        }
        const task = {
          id: nextId,
          title: body.title.trim(),
          completed: false,
          priority: body.priority,
          categoryId: body.categoryId,
        };
        nextId += 1;
        tasks.push(task);
        sendJson(res, 201, { data: task }, false, { Location: `/api/tasks/${task.id}` });
        return;
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch) {
        let rawId;
        try {
          rawId = decodeURIComponent(taskMatch[1]);
        } catch {
          sendError(res, 400, "INVALID_ID", "Идентификатор задачи имеет неверный формат.", undefined, head);
          return;
        }
        const id = parsePositiveId(rawId);
        if (id === null) {
          sendError(res, 400, "INVALID_ID", "id должен быть положительным целым числом.", undefined, head);
          return;
        }
        const index = tasks.findIndex((task) => task.id === id);
        if (index < 0) {
          sendError(res, 404, "TASK_NOT_FOUND", `Задача с id ${id} не найдена.`, { id }, head);
          return;
        }

        if (method === "GET") {
          sendJson(res, 200, { data: tasks[index] }, head);
          return;
        }
        if (req.method === "PATCH") {
          const body = await readJsonBody(req);
          const details = validateTaskFields(body, { partial: true, categoryIds });
          if (Object.keys(details).length > 0) {
            sendError(res, 400, "VALIDATION_ERROR", "Данные задачи не прошли проверку.", details);
            return;
          }
          const changes = { ...body };
          if ("title" in changes) changes.title = changes.title.trim();
          tasks[index] = { ...tasks[index], ...changes, id };
          sendJson(res, 200, { data: tasks[index] });
          return;
        }
        if (req.method === "DELETE") {
          tasks.splice(index, 1);
          sendEmpty(res, 204);
          return;
        }
        sendError(res, 405, "METHOD_NOT_ALLOWED", "Для задачи доступны GET, HEAD, PATCH, DELETE и OPTIONS.", undefined, false, {
          Allow: "GET, HEAD, PATCH, DELETE, OPTIONS",
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/categories") {
        sendJson(res, 200, { data: categories, meta: { total: categories.length } }, head);
        return;
      }

      if (method === "GET" && url.pathname === "/api/debug/delay") {
        const ms = parseDelay(url.searchParams);
        await new Promise((resolve) => setTimeout(resolve, ms));
        if (!res.destroyed) sendJson(res, 200, { data: { delayedMs: ms } }, head);
        return;
      }

      if (method === "GET" && url.pathname === "/api/debug/error") {
        sendError(res, 503, "SERVICE_UNAVAILABLE", "Учебная имитация временной недоступности сервиса.", undefined, head);
        return;
      }
      if (method === "GET" && url.pathname === "/api/debug/invalid-json") {
        sendRaw(res, 200, "{\"data\":", "application/json; charset=utf-8", head);
        return;
      }
      if (method === "GET" && url.pathname === "/api/debug/text") {
        sendRaw(res, 200, "Это не JSON.", "text/plain; charset=utf-8", head);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/debug/reset") {
        resetState();
        sendJson(res, 200, { data: { reset: true, total: tasks.length } });
        return;
      }

      if (url.pathname === "/api/tasks") {
        sendError(res, 405, "METHOD_NOT_ALLOWED", "Для списка задач доступны GET, HEAD, POST и OPTIONS.", undefined, false, {
          Allow: "GET, HEAD, POST, OPTIONS",
        });
        return;
      }

      sendError(res, 404, "ROUTE_NOT_FOUND", `Маршрут ${url.pathname} не найден.`, undefined, head);
    } catch (error) {
      if (error instanceof TypeError) {
        sendError(res, 400, "INVALID_QUERY", error.message, undefined, head);
      } else if (error.status && error.code) {
        sendError(res, error.status, error.code, error.message);
      } else {
        console.error(error);
        if (!res.headersSent) sendError(res, 500, "INTERNAL_ERROR", "Внутренняя ошибка учебного API.");
        else res.destroy();
      }
    }
  });
}

export function readPort(raw, fallback = DEFAULT_PORT) {
  const port = Number(raw ?? fallback);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new TypeError("Порт должен быть целым числом от 1024 до 65535.");
  }
  return port;
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  let port;
  try {
    port = readPort(process.argv[2] ?? process.env.API_PORT);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const server = createApiServer();
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? `Порт API ${port} занят.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, HOST, () => {
    console.log(`Учебный API: http://${HOST}:${port}/api`);
    console.log("Остановка: Ctrl+C. Изменения данных хранятся до остановки сервера.");
  });
}
