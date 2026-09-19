// Готовый локальный API для ПР5–ПР6. Реализация сервера не входит в ПР5.
// Сервер хранит неизменяемый учебный набор в памяти и слушает только 127.0.0.1.
import http from "node:http";
import { pathToFileURL } from "node:url";
import { categories, tasks } from "./data.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5505;
const PRIORITIES = new Set(["low", "medium", "high"]);
const FILTER_NAMES = new Set(["completed", "priority", "categoryId", "q"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
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
  if (values.length > 1) {
    throw new TypeError(`Параметр ${name} нельзя повторять.`);
  }
  return values[0] ?? null;
}

function parseFilters(searchParams) {
  for (const name of searchParams.keys()) {
    if (!FILTER_NAMES.has(name)) {
      throw new TypeError(`Неизвестный параметр запроса: ${name}.`);
    }
  }

  const filters = {
    completed: null,
    priority: null,
    categoryId: null,
    q: "",
  };

  const completed = oneValue(searchParams, "completed");
  if (completed !== null) {
    if (completed !== "true" && completed !== "false") {
      throw new TypeError("completed должен быть true или false.");
    }
    filters.completed = completed === "true";
  }

  const priority = oneValue(searchParams, "priority");
  if (priority !== null) {
    if (!PRIORITIES.has(priority)) {
      throw new TypeError("priority должен быть low, medium или high.");
    }
    filters.priority = priority;
  }

  const categoryId = oneValue(searchParams, "categoryId");
  if (categoryId !== null) {
    const parsed = Number(categoryId);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== categoryId) {
      throw new TypeError("categoryId должен быть положительным целым числом.");
    }
    filters.categoryId = parsed;
  }

  const q = oneValue(searchParams, "q");
  if (q !== null) {
    const normalized = q.trim();
    if (normalized.length > 100) {
      throw new TypeError("q не должен быть длиннее 100 символов.");
    }
    filters.q = normalized;
  }

  return filters;
}

function selectTasks(filters) {
  const needle = filters.q.toLocaleLowerCase("ru-RU");
  return tasks.filter((task) => {
    if (filters.completed !== null && task.completed !== filters.completed) return false;
    if (filters.priority !== null && task.priority !== filters.priority) return false;
    if (filters.categoryId !== null && task.categoryId !== filters.categoryId) return false;
    if (needle && !task.title.toLocaleLowerCase("ru-RU").includes(needle)) return false;
    return true;
  });
}

function parsePositiveId(rawId) {
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : null;
}

function parseDelay(searchParams) {
  for (const name of searchParams.keys()) {
    if (name !== "ms") throw new TypeError(`Неизвестный параметр запроса: ${name}.`);
  }
  const raw = oneValue(searchParams, "ms") ?? "1000";
  if (!/^\d+$/.test(raw)) throw new TypeError("ms должен быть целым числом от 0 до 5000.");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 5000) {
    throw new TypeError("ms должен быть целым числом от 0 до 5000.");
  }
  return value;
}

async function routeGet(req, res, url, head) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, { data: { status: "ok" } }, head);
    return;
  }

  if (url.pathname === "/api/tasks") {
    try {
      const filters = parseFilters(url.searchParams);
      const selected = selectTasks(filters);
      sendJson(res, 200, {
        data: selected,
        meta: { total: selected.length, filters },
      }, head);
    } catch (error) {
      sendError(res, 400, "INVALID_QUERY", error.message, undefined, head);
    }
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
    const task = tasks.find((item) => item.id === id);
    if (!task) {
      sendError(
        res,
        404,
        "TASK_NOT_FOUND",
        `Задача с id ${id} не найдена.`,
        { id },
        head,
      );
      return;
    }
    sendJson(res, 200, { data: task }, head);
    return;
  }

  if (url.pathname === "/api/categories") {
    sendJson(res, 200, {
      data: categories,
      meta: { total: categories.length },
    }, head);
    return;
  }

  const categoryMatch = url.pathname.match(/^\/api\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const id = parsePositiveId(categoryMatch[1]);
    if (id === null) {
      sendError(res, 400, "INVALID_ID", "id должен быть положительным целым числом.", undefined, head);
      return;
    }
    const category = categories.find((item) => item.id === id);
    if (!category) {
      sendError(
        res,
        404,
        "CATEGORY_NOT_FOUND",
        `Категория с id ${id} не найдена.`,
        { id },
        head,
      );
      return;
    }
    sendJson(res, 200, { data: category }, head);
    return;
  }

  if (url.pathname === "/api/debug/delay") {
    try {
      const ms = parseDelay(url.searchParams);
      await new Promise((resolve) => setTimeout(resolve, ms));
      sendJson(res, 200, { data: { delayedMs: ms } }, head);
    } catch (error) {
      sendError(res, 400, "INVALID_QUERY", error.message, undefined, head);
    }
    return;
  }

  if (url.pathname === "/api/debug/error") {
    sendError(
      res,
      503,
      "SERVICE_UNAVAILABLE",
      "Учебная имитация временной недоступности сервиса.",
      undefined,
      head,
    );
    return;
  }

  if (url.pathname === "/api/debug/invalid-json") {
    sendRaw(res, 200, "{\"data\":", "application/json; charset=utf-8", head);
    return;
  }

  if (url.pathname === "/api/debug/text") {
    sendRaw(res, 200, "Это не JSON.", "text/plain; charset=utf-8", head);
    return;
  }

  sendError(
    res,
    404,
    "ROUTE_NOT_FOUND",
    `Маршрут ${url.pathname} не найден.`,
    undefined,
    head,
  );
}

export function createApiServer() {
  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url ?? "/", `http://${HOST}`);
    } catch {
      sendError(res, 400, "BAD_REQUEST", "Не удалось разобрать адрес запроса.");
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Cache-Control": "no-store",
        ...corsHeaders(),
      });
      res.end();
      return;
    }

    const head = req.method === "HEAD";
    if (req.method !== "GET" && !head) {
      sendError(
        res,
        405,
        "METHOD_NOT_ALLOWED",
        "Для ПР5 доступны методы GET, HEAD и OPTIONS.",
        undefined,
        false,
        { Allow: "GET, HEAD, OPTIONS" },
      );
      return;
    }

    try {
      await routeGet(req, res, url, head);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        sendError(res, 500, "INTERNAL_ERROR", "Внутренняя ошибка учебного API.", undefined, head);
      } else {
        res.destroy();
      }
    }
  });
}

function readPort(raw) {
  const port = Number(raw ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new TypeError("Порт должен быть целым числом от 1024 до 65535.");
  }
  return port;
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  let port;
  try {
    port = readPort(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const server = createApiServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Порт ${port} занят. Например: node api/server.mjs ${port + 1}`);
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  });
  server.listen(port, HOST, () => {
    console.log(`Учебный API ПР5: http://${HOST}:${port}/api`);
    console.log(`Проверка: http://${HOST}:${port}/api/health`);
    console.log("Остановка: Ctrl+C.");
  });
}
