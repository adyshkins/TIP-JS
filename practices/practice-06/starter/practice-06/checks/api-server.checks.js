// Проверки готового учебного API ПР6. Код сервера изменять не требуется.
import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";

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

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const server = createApiServer();
const baseUrl = await listen(server);

try {
  await check("01. health возвращает JSON и заголовки CORS", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await readJson(response), { data: { status: "ok" } });
  });

  await check("02. исходный список содержит 12 задач в контрольном порядке", async () => {
    const payload = await readJson(await fetch(`${baseUrl}/tasks`));
    assert.deepEqual(payload.data.map((task) => task.id), [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    assert.equal(payload.meta.total, 12);
  });

  await check("03. фильтры и поиск применяются совместно", async () => {
    const payload = await readJson(await fetch(`${baseUrl}/tasks?completed=false&priority=high&categoryId=2&q=%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D1%8C`));
    assert.deepEqual(payload.data.map((task) => task.id), [4]);
    assert.deepEqual(payload.meta.filters, {
      completed: false,
      priority: "high",
      categoryId: 2,
      q: "модель",
    });
  });

  await check("04. неверный или повторяющийся query даёт 400", async () => {
    for (const query of ["completed=yes", "priority=urgent", "q=a&q=b", "unknown=1"]) {
      const response = await fetch(`${baseUrl}/tasks?${query}`);
      assert.equal(response.status, 400);
      assert.equal((await readJson(response)).error.code, "INVALID_QUERY");
    }
  });

  let createdId;
  await check("05. POST создаёт задачу, обрезает title и назначает id", async () => {
    const response = await fetch(`${baseUrl}/tasks`, jsonOptions("POST", {
      title: "  Связать интерфейс с API  ",
      priority: "high",
      categoryId: 2,
    }));
    const payload = await readJson(response);
    assert.equal(response.status, 201);
    assert.equal(payload.data.id, 35);
    assert.equal(payload.data.title, "Связать интерфейс с API");
    assert.equal(payload.data.completed, false);
    assert.equal(response.headers.get("location"), "/api/tasks/35");
    createdId = payload.data.id;
  });

  await check("06. созданная задача доступна по id и в списке", async () => {
    const one = await readJson(await fetch(`${baseUrl}/tasks/${createdId}`));
    assert.equal(one.data.title, "Связать интерфейс с API");
    const all = await readJson(await fetch(`${baseUrl}/tasks`));
    assert.equal(all.meta.total, 13);
    assert.ok(all.data.some((task) => task.id === createdId));
  });

  await check("07. POST требует application/json", async () => {
    const response = await fetch(`${baseUrl}/tasks`, { method: "POST", body: "{}" });
    assert.equal(response.status, 415);
    assert.equal((await readJson(response)).error.code, "UNSUPPORTED_MEDIA_TYPE");
  });

  await check("08. повреждённый JSON даёт структурированную ошибку", async () => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{broken",
    });
    assert.equal(response.status, 400);
    assert.equal((await readJson(response)).error.code, "INVALID_JSON");
  });

  await check("09. серверная валидация сообщает ошибки полей", async () => {
    const response = await fetch(`${baseUrl}/tasks`, jsonOptions("POST", {
      title: "   ",
      priority: "urgent",
      categoryId: 99,
      completed: true,
    }));
    const payload = await readJson(response);
    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.deepEqual(Object.keys(payload.error.details).sort(), ["categoryId", "completed", "priority", "title"]);
  });

  await check("10. PATCH изменяет только переданные поля", async () => {
    const response = await fetch(`${baseUrl}/tasks/${createdId}`, jsonOptions("PATCH", {
      title: "  Обновлённая задача  ",
      priority: "low",
    }));
    const task = (await readJson(response)).data;
    assert.equal(response.status, 200);
    assert.deepEqual(task, {
      id: createdId,
      title: "Обновлённая задача",
      completed: false,
      priority: "low",
      categoryId: 2,
    });
  });

  await check("11. PATCH изменяет completed логическим значением", async () => {
    const response = await fetch(`${baseUrl}/tasks/${createdId}`, jsonOptions("PATCH", { completed: true }));
    assert.equal((await readJson(response)).data.completed, true);
  });

  await check("12. пустой PATCH и неизвестное поле отклоняются", async () => {
    for (const body of [{}, { owner: "user" }]) {
      const response = await fetch(`${baseUrl}/tasks/${createdId}`, jsonOptions("PATCH", body));
      assert.equal(response.status, 400);
      assert.equal((await readJson(response)).error.code, "VALIDATION_ERROR");
    }
  });

  await check("13. DELETE возвращает 204 без тела", async () => {
    const response = await fetch(`${baseUrl}/tasks/${createdId}`, { method: "DELETE" });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("content-type"), null);
    const missing = await fetch(`${baseUrl}/tasks/${createdId}`);
    assert.equal(missing.status, 404);
  });

  await check("14. отсутствующая задача даёт 404 для PATCH и DELETE", async () => {
    for (const options of [jsonOptions("PATCH", { completed: true }), { method: "DELETE" }]) {
      const response = await fetch(`${baseUrl}/tasks/999`, options);
      const payload = await readJson(response);
      assert.equal(response.status, 404);
      assert.equal(payload.error.code, "TASK_NOT_FOUND");
      assert.deepEqual(payload.error.details, { id: 999 });
    }
  });

  await check("15. неверный id даёт 400", async () => {
    for (const id of ["0", "-1", "4.5", "abc"]) {
      const response = await fetch(`${baseUrl}/tasks/${id}`);
      assert.equal(response.status, 400);
      assert.equal((await readJson(response)).error.code, "INVALID_ID");
    }
  });

  await check("16. категории доступны отдельным ресурсом", async () => {
    const payload = await readJson(await fetch(`${baseUrl}/categories`));
    assert.deepEqual(payload.data, [
      { id: 1, name: "Учёба" },
      { id: 2, name: "Проект" },
      { id: 3, name: "Организация" },
    ]);
    assert.equal(payload.meta.total, 3);
  });

  await check("17. HEAD возвращает заголовки без тела", async () => {
    const response = await fetch(`${baseUrl}/tasks`, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.ok(Number(response.headers.get("content-length")) > 0);
    assert.equal(await response.text(), "");
  });

  await check("18. OPTIONS объявляет CORS для изменяющих методов", async () => {
    const response = await fetch(`${baseUrl}/tasks`, { method: "OPTIONS" });
    assert.equal(response.status, 204);
    const methods = response.headers.get("access-control-allow-methods") ?? "";
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) assert.match(methods, new RegExp(method));
    assert.match(response.headers.get("access-control-allow-headers") ?? "", /Content-Type/i);
  });

  await check("19. неподдерживаемый метод даёт 405 и Allow", async () => {
    const response = await fetch(`${baseUrl}/tasks`, { method: "PUT" });
    assert.equal(response.status, 405);
    assert.equal((await readJson(response)).error.code, "METHOD_NOT_ALLOWED");
    assert.equal(response.headers.get("allow"), "GET, HEAD, POST, OPTIONS");
  });

  await check("20. отладочные маршруты воспроизводят виды ошибок", async () => {
    const unavailable = await fetch(`${baseUrl}/debug/error`);
    assert.equal(unavailable.status, 503);
    assert.equal((await readJson(unavailable)).error.code, "SERVICE_UNAVAILABLE");
    const invalid = await fetch(`${baseUrl}/debug/invalid-json`);
    await assert.rejects(() => invalid.json(), SyntaxError);
    const text = await fetch(`${baseUrl}/debug/text`);
    assert.match(text.headers.get("content-type") ?? "", /^text\/plain\b/i);
    const delayed = await readJson(await fetch(`${baseUrl}/debug/delay?ms=5`));
    assert.equal(delayed.data.delayedMs, 5);
  });

  await check("21. слишком большое тело запроса отклоняется", async () => {
    const response = await fetch(`${baseUrl}/tasks`, jsonOptions("POST", {
      title: "x".repeat(17 * 1024), priority: "low", categoryId: 1,
    }));
    assert.equal(response.status, 413);
    assert.equal((await readJson(response)).error.code, "PAYLOAD_TOO_LARGE");
  });

  await check("22. reset восстанавливает данные и счётчик id", async () => {
    const reset = await fetch(`${baseUrl}/debug/reset`, { method: "POST" });
    assert.deepEqual(await readJson(reset), { data: { reset: true, total: 12 } });
    const created = await readJson(await fetch(`${baseUrl}/tasks`, jsonOptions("POST", {
      title: "После сброса", priority: "medium", categoryId: 1,
    })));
    assert.equal(created.data.id, 35);
    await fetch(`${baseUrl}/debug/reset`, { method: "POST" });
  });

  await check("23. два экземпляра API не делят изменяемое состояние", async () => {
    const second = createApiServer();
    const secondUrl = await listen(second);
    try {
      const first = await readJson(await fetch(`${baseUrl}/tasks`));
      const other = await readJson(await fetch(`${secondUrl}/tasks`));
      assert.equal(first.meta.total, 12);
      assert.equal(other.meta.total, 12);
    } finally {
      await close(second);
    }
  });
} finally {
  await close(server);
}

console.log(`\nИтог API: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
