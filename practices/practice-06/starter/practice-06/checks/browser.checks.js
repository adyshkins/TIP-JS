// Браузерные проверки ПР6. Открывать checks.html через npm start.
import { createTaskElement, renderTaskList } from "../src/task-view.js";

const API_URL = "http://127.0.0.1:5505/api";
const results = document.querySelector("#check-results");
const log = document.querySelector("#check-log");
const summary = document.querySelector("#check-summary");
const fixture = document.querySelector("#test-fixture");
const frame = document.querySelector("#test-frame");
const transcript = [];
let passed = 0;
let failed = 0;
let run = 0;

function assert(condition, message = "Условие не выполнено") {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message = "Значения отличаются") {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${message}: получено ${JSON.stringify(actual)}, ожидалось ${JSON.stringify(expected)}`);
}

async function check(name, action) {
  fixture.replaceChildren();
  const item = document.createElement("li");
  try {
    await action();
    passed += 1;
    item.className = "check-pass";
    item.textContent = `OK: ${name}`;
  } catch (error) {
    failed += 1;
    item.className = "check-fail";
    item.textContent = `FAIL: ${name} — ${error.message}`;
  }
  results.append(item);
  transcript.push(item.textContent);
  log.textContent = transcript.join("\n");
}

function task(overrides = {}) {
  return {
    id: 4, title: "Подготовить модель задач", completed: false,
    priority: "high", categoryId: 2, ...overrides,
  };
}

const categories = [
  { id: 1, name: "Учёба" },
  { id: 2, name: "Проект" },
  { id: 3, name: "Организация" },
];

function requireNode(root, selector) {
  const node = root.querySelector(selector);
  assert(node, `Не найден элемент: ${selector}`);
  return node;
}

async function waitFor(condition, message, timeout = 5000) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const value = condition();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

async function resetApi() {
  const response = await fetch(`${API_URL}/debug/reset`, { method: "POST" });
  assert(response.ok, "Не удалось восстановить учебный API");
}

async function openApp({ reset = true, apiUrl = API_URL } = {}) {
  if (reset) await resetApi();
  run += 1;
  const url = new URL("./index.html", window.location.href);
  url.searchParams.set("run", String(run));
  if (apiUrl !== API_URL) url.searchParams.set("api", apiUrl);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Страница не загрузилась")), 5000);
    frame.addEventListener("load", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    frame.src = url.href;
  });

  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const app = await waitFor(
    () => win.practice06
      ?? (doc.querySelector("#list-state")?.dataset.kind === "error" ? { startupError: true } : null),
    "Приложение не создало window.practice06",
  );
  assert(!app.startupError, "Приложение не запустилось; проверьте заглушки в src");
  await app.ready;
  return { win, doc, app };
}

function visibleIds(doc) {
  return [...doc.querySelectorAll("#task-list > [data-task-id]")]
    .map((node) => Number(node.dataset.taskId));
}

function change(doc, selector, value) {
  const control = requireNode(doc, selector);
  control.value = value;
  control.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
  control.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
}

function submit(doc, selector) {
  requireNode(doc, selector).requestSubmit();
}

function click(doc, selector) {
  requireNode(doc, selector).click();
}

await check("Карточка содержит безопасный текст и три действия", () => {
  const title = '<img src=x onerror="alert(1)"> & API';
  const node = createTaskElement(task({ title }), categories[1]);
  assert(node instanceof HTMLLIElement, "Ожидается элемент li");
  same(node.dataset.taskId, "4");
  const heading = requireNode(node, ".task-title");
  same(heading.textContent, title);
  same(heading.children.length, 0);
  for (const action of ["toggle", "edit", "delete"]) {
    requireNode(node, `button[data-action="${action}"] .action-label`);
  }
  same(requireNode(node, ".task-category").textContent, "Проект");
});

await check("Повторная отрисовка списка не накапливает карточки", () => {
  const list = document.createElement("ul");
  fixture.append(list);
  renderTaskList(list, [task(), task({ id: 7 })], categories);
  renderTaskList(list, [task({ id: 10 })], categories);
  same([...list.children].map((node) => Number(node.dataset.taskId)), [10]);
});

await check("Начальная загрузка показывает 12 задач и 3 категории", async () => {
  const { doc } = await openApp();
  same(visibleIds(doc), [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
  same(requireNode(doc, "#task-total").textContent, "12");
  same(requireNode(doc, "#task-category").options.length, 4);
  same(requireNode(doc, "#list-state").dataset.kind, "ready");
  same(requireNode(doc, "#list-panel").getAttribute("aria-busy"), "false");
});

await check("Фильтры формируют новый серверный запрос", async () => {
  const { doc } = await openApp();
  change(doc, "#filter-completed", "false");
  change(doc, "#filter-priority", "high");
  change(doc, "#filter-category", "2");
  submit(doc, "#filters-form");
  await waitFor(() => visibleIds(doc).length === 2, "Фильтр не применился");
  same(visibleIds(doc), [4, 34]);
  same(requireNode(doc, "#task-total").textContent, "2");
});

await check("Поиск без результатов показывает empty, а сброс возвращает список", async () => {
  const { doc } = await openApp();
  change(doc, "#filter-query", "такой задачи точно нет");
  submit(doc, "#filters-form");
  await waitFor(() => requireNode(doc, "#list-state").dataset.kind === "empty", "Нет состояния empty");
  same(requireNode(doc, "#task-total").textContent, "0");
  click(doc, "#clear-filters");
  await waitFor(() => visibleIds(doc).length === 12, "Список не восстановился");
});

await check("Корректная форма создаёт задачу с серверным id", async () => {
  const { doc } = await openApp();
  change(doc, "#task-title", "  Подключить браузер  ");
  change(doc, "#task-priority", "high");
  change(doc, "#task-category", "2");
  submit(doc, "#task-form");
  await waitFor(() => requireNode(doc, '[data-task-id="35"]'), "Задача не появилась");
  same(requireNode(doc, '[data-task-id="35"] .task-title').textContent, "Подключить браузер");
  same(requireNode(doc, "#task-title").value, "");
  same(requireNode(doc, "#task-total").textContent, "13");
});

await check("Ошибки формы не отправляют запрос и связаны с полями", async () => {
  const { doc } = await openApp();
  change(doc, "#task-title", "   ");
  change(doc, "#task-priority", "low");
  change(doc, "#task-category", "1");
  submit(doc, "#task-form");
  await waitFor(() => requireNode(doc, "#task-title-error").textContent, "Ошибка title не показана");
  same(visibleIds(doc).length, 12);
  same(requireNode(doc, "#task-title").getAttribute("aria-invalid"), "true");
});

await check("Редактирование заполняет форму и сохраняет изменения", async () => {
  const { doc } = await openApp();
  click(doc, '[data-task-id="4"] [data-action="edit"]');
  same(requireNode(doc, "#task-title").value, "Подготовить модель задач");
  same(requireNode(doc, "#form-submit").textContent, "Сохранить изменения");
  assert(!requireNode(doc, "#cancel-edit").hidden);
  change(doc, "#task-title", "Обновить модель задач");
  change(doc, "#task-priority", "low");
  change(doc, "#task-category", "1");
  submit(doc, "#task-form");
  await waitFor(() => requireNode(doc, '[data-task-id="4"] .task-title').textContent === "Обновить модель задач", "Изменения не появились");
  same(requireNode(doc, '[data-task-id="4"] .task-category').textContent, "Учёба");
  same(requireNode(doc, "#form-submit").textContent, "Добавить задачу");
});

await check("Отмена редактирования возвращает режим создания", async () => {
  const { doc } = await openApp();
  click(doc, '[data-task-id="7"] [data-action="edit"]');
  click(doc, "#cancel-edit");
  same(requireNode(doc, "#task-title").value, "");
  same(requireNode(doc, "#form-submit").textContent, "Добавить задачу");
  assert(requireNode(doc, "#cancel-edit").hidden);
});

await check("Смена статуса подтверждается сервером", async () => {
  const { doc } = await openApp();
  const card = requireNode(doc, '[data-task-id="4"]');
  assert(!card.classList.contains("is-completed"));
  click(doc, '[data-task-id="4"] [data-action="toggle"]');
  await waitFor(() => requireNode(doc, '[data-task-id="4"]').classList.contains("is-completed"), "Статус не изменился");
  const payload = await (await fetch(`${API_URL}/tasks/4`)).json();
  assert(payload.data.completed, "Статус не сохранился на сервере");
});

await check("Удаление подтверждается и сохраняется на сервере", async () => {
  const { doc, win } = await openApp();
  win.confirm = () => true;
  click(doc, '[data-task-id="7"] [data-action="delete"]');
  await waitFor(() => !doc.querySelector('[data-task-id="7"]'), "Задача не исчезла");
  same((await fetch(`${API_URL}/tasks/7`)).status, 404);
});

await check("Сброс восстанавливает учебный набор", async () => {
  const { doc, win } = await openApp();
  win.confirm = () => true;
  click(doc, '[data-task-id="7"] [data-action="delete"]');
  await waitFor(() => !doc.querySelector('[data-task-id="7"]'), "Подготовительное удаление не выполнено");
  click(doc, "#reset-data");
  await waitFor(() => visibleIds(doc).length === 12, "Исходный набор не восстановлен");
  assert(requireNode(doc, '[data-task-id="7"]'));
});

await check("Недоступный API показывает error и кнопку повтора", async () => {
  const { doc } = await openApp({ reset: false, apiUrl: "http://127.0.0.1:1/api" });
  same(requireNode(doc, "#list-state").dataset.kind, "error");
  assert(!requireNode(doc, "#retry-load").hidden);
  assert(requireNode(doc, "#list-state").textContent.includes("соединения"));
});

await check("Приложение не использует localStorage как источник данных", async () => {
  localStorage.setItem("tip-js-practice-06:trap", JSON.stringify([{ id: 999 }]));
  const { doc } = await openApp();
  assert(!visibleIds(doc).includes(999));
  localStorage.removeItem("tip-js-practice-06:trap");
});

await resetApi().catch(() => {});
summary.textContent = `Всего: ${passed + failed}. Пройдено: ${passed}. Ошибок: ${failed}.`;
summary.className = failed === 0 ? "check-pass" : "check-fail";
