// Проверки готового учебного API ПР5. Код сервера изменять не требуется.
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
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(response) {
  const text = await response.text();
  return text.length === 0 ? null : JSON.parse(text);
}

const server = createApiServer();
const baseUrl = await listen(server);

try {
  await check("01. health возвращает состояние API и обязательные заголовки", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.equal(response.ok, true);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await readJson(response), { data: { status: "ok" } });
  });

  await check("02. список задач сохраняет контрольный порядок", async () => {
    const response = await fetch(`${baseUrl}/tasks`);
    const payload = await readJson(response);
    assert.equal(response.status, 200);
    assert.deepEqual(payload.data.map((task) => task.id), [
      1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34,
    ]);
    assert.equal(payload.meta.total, 12);
  });

  await check("03. completed=false отбирает невыполненные задачи", async () => {
    const payload = await readJson(await fetch(`${baseUrl}/tasks?completed=false`));
    assert.deepEqual(payload.data.map((task) => task.id), [4, 7, 13, 19, 22, 28, 34]);
    assert.equal(payload.meta.filters.completed, false);
  });

  await check("04. несколько фильтров применяются совместно", async () => {
    const response = await fetch(
      `${baseUrl}/tasks?completed=false&priority=high&categoryId=2`,
    );
    const payload = await readJson(response);
    assert.deepEqual(payload.data.map((task) => task.id), [4, 34]);
    assert.equal(payload.meta.total, 2);
  });

  await check("05. q выполняет регистронезависимый поиск по названию", async () => {
    const url = new URL(`${baseUrl}/tasks`);
    url.searchParams.set("q", "ПРОВЕР");
    const payload = await readJson(await fetch(url));
    assert.deepEqual(payload.data.map((task) => task.id), [7, 16]);
    assert.equal(payload.meta.filters.q, "ПРОВЕР");
  });

  await check("06. пустой q не отбирает задачи", async () => {
    const payload = await readJson(await fetch(`${baseUrl}/tasks?q=%20%20`));
    assert.equal(payload.data.length, 12);
    assert.equal(payload.meta.filters.q, "");
  });

  await check("07. неверное значение completed даёт JSON-ошибку 400", async () => {
    const response = await fetch(`${baseUrl}/tasks?completed=yes`);
    const payload = await readJson(response);
    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "INVALID_QUERY");
    assert.match(payload.error.message, /completed/);
  });

  await check("08. неизвестный и повторяющийся параметры отклоняются", async () => {
    for (const suffix of ["unknown=1", "priority=high&priority=low"]) {
      const response = await fetch(`${baseUrl}/tasks?${suffix}`);
      const payload = await readJson(response);
      assert.equal(response.status, 400);
      assert.equal(payload.error.code, "INVALID_QUERY");
    }
  });

  await check("09. задача запрашивается по положительному id", async () => {
    const response = await fetch(`${baseUrl}/tasks/25`);
    const payload = await readJson(response);
    assert.equal(response.status, 200);
    assert.deepEqual(payload.data, {
      id: 25,
      title: "Исправить обработку ошибок",
      completed: true,
      priority: "high",
      categoryId: 2,
    });
  });

  await check("10. отсутствующая задача даёт структурированную ошибку 404", async () => {
    const response = await fetch(`${baseUrl}/tasks/999`);
    const payload = await readJson(response);
    assert.equal(response.status, 404);
    assert.deepEqual(payload.error.details, { id: 999 });
    assert.equal(payload.error.code, "TASK_NOT_FOUND");
  });

  await check("11. неверный формат id даёт ошибку 400", async () => {
    for (const id of ["0", "-1", "4.5", "abc"]) {
      const response = await fetch(`${baseUrl}/tasks/${id}`);
      const payload = await readJson(response);
      assert.equal(response.status, 400);
      assert.equal(payload.error.code, "INVALID_ID");
    }
  });

  await check("12. API возвращает категории", async () => {
    const response = await fetch(`${baseUrl}/categories`);
    const payload = await readJson(response);
    assert.deepEqual(payload.data, [
      { id: 1, name: "Учёба" },
      { id: 2, name: "Проект" },
      { id: 3, name: "Организация" },
    ]);
    assert.equal(payload.meta.total, 3);
  });

  await check("13. категория запрашивается по id, отсутствие даёт 404", async () => {
    const found = await readJson(await fetch(`${baseUrl}/categories/2`));
    assert.deepEqual(found.data, { id: 2, name: "Проект" });

    const missingResponse = await fetch(`${baseUrl}/categories/99`);
    const missing = await readJson(missingResponse);
    assert.equal(missingResponse.status, 404);
    assert.equal(missing.error.code, "CATEGORY_NOT_FOUND");
  });

  await check("14. HEAD возвращает заголовки без тела", async () => {
    const response = await fetch(`${baseUrl}/tasks`, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    assert.ok(Number(response.headers.get("content-length")) > 0);
    assert.equal(await response.text(), "");
  });

  await check("15. OPTIONS сообщает правила CORS", async () => {
    const response = await fetch(`${baseUrl}/tasks`, { method: "OPTIONS" });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("access-control-allow-methods") ?? "", /GET/);
  });

  await check("16. неподдерживаемый метод даёт 405 и Allow", async () => {
    const response = await fetch(`${baseUrl}/tasks`, { method: "POST" });
    const payload = await readJson(response);
    assert.equal(response.status, 405);
    assert.equal(payload.error.code, "METHOD_NOT_ALLOWED");
    assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
  });

  await check("17. неизвестный маршрут даёт ошибку 404", async () => {
    const response = await fetch(`${baseUrl}/missing`);
    const payload = await readJson(response);
    assert.equal(response.status, 404);
    assert.equal(payload.error.code, "ROUTE_NOT_FOUND");
  });

  await check("18. отладочные маршруты воспроизводят 503, не-JSON и задержку", async () => {
    const unavailable = await fetch(`${baseUrl}/debug/error`);
    assert.equal(unavailable.status, 503);
    assert.equal((await readJson(unavailable)).error.code, "SERVICE_UNAVAILABLE");

    const invalidJson = await fetch(`${baseUrl}/debug/invalid-json`);
    assert.match(invalidJson.headers.get("content-type") ?? "", /^application\/json\b/i);
    await assert.rejects(() => invalidJson.json(), SyntaxError);

    const text = await fetch(`${baseUrl}/debug/text`);
    assert.match(text.headers.get("content-type") ?? "", /^text\/plain\b/i);
    assert.equal(await text.text(), "Это не JSON.");

    const delayed = await readJson(await fetch(`${baseUrl}/debug/delay?ms=5`));
    assert.deepEqual(delayed, { data: { delayedMs: 5 } });
  });
} finally {
  await close(server);
}

console.log(`\nИтог API: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
