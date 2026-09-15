// Готовые проверки ПР3. Открывать checks.html через локальный сервер.
// Реализаций прикладных функций здесь нет. Все DOM-проверки выполняются в браузере.
import { getVisibleTasks } from "../src/task-selectors.js";
import { createTaskElement, renderTaskList, renderSummary, renderEmptyState } from "../src/task-view.js";

const results = document.querySelector("#check-results");
const log = document.querySelector("#check-log");
const summary = document.querySelector("#check-summary");
const fixtureRoot = document.querySelector("#test-fixture");
const frame = document.querySelector("#test-frame");
let passed = 0;
let failed = 0;
let loadNumber = 0;
let appErrors = [];
const transcript = [];

function assert(condition, message = "Условие не выполнено") {
  if (!condition) throw new Error(message);
}
function same(actual, expected, message = "Результаты отличаются") {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${message}: получено ${JSON.stringify(actual)}, ожидалось ${JSON.stringify(expected)}`);
}
async function check(name, action) {
  fixtureRoot.replaceChildren();
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
function tasks() {
  return [
    { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
    { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
    { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
    { id: 10, title: "Оформить README", completed: true, priority: "medium" },
  ];
}
function frozenTasks() {
  return Object.freeze(tasks().map((task) => Object.freeze(task)));
}
const ids = (items) => items.map((item) => item.id);
function element(tag = "div") {
  const node = document.createElement(tag);
  fixtureRoot.append(node);
  return node;
}
function summaryElement() {
  const root = element();
  for (const name of ["total", "completed", "pending", "progress", "visible"]) {
    const node = document.createElement("span");
    node.dataset.stat = name;
    root.append(node);
  }
  return root;
}
function readSummary(root) {
  return ["total", "completed", "pending", "progress", "visible"]
    .map((name) => root.querySelector(`[data-stat="${name}"]`)?.textContent.trim());
}
function requireNode(root, selector) {
  const node = root.querySelector(selector);
  assert(node, `Не найден элемент: ${selector}`);
  return node;
}
function click(root, selector) {
  requireNode(root, selector).click();
  assert(appErrors.length === 0, `Ошибка обработчика: ${appErrors.join("; ")}`);
}
function visibleIds(doc) {
  return [...doc.querySelectorAll("#task-list > [data-task-id]")]
    .map((node) => Number(node.dataset.taskId));
}
function stats(doc) {
  return readSummary(requireNode(doc, "#task-summary"));
}
function freshApp() {
  loadNumber += 1;
  appErrors = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      frame.removeEventListener("load", loaded);
      reject(new Error("Приложение не загрузилось за 10 секунд"));
    }, 10000);
    function loaded() {
      clearTimeout(timer);
      frame.removeEventListener("load", loaded);
      const doc = frame.contentDocument;
      if (!doc?.querySelector("#task-list")) {
        reject(new Error("В iframe не найдена страница приложения"));
        return;
      }
      frame.contentWindow.addEventListener("error", (event) => appErrors.push(event.message));
      resolve(doc);
    }
    frame.addEventListener("load", loaded);
    frame.src = `./index.html?check=${loadNumber}`;
  });
}
const row = (id) => `#task-list > [data-task-id="${id}"]`;
const action = (id, kind) => `${row(id)} button[data-action="${kind}"] .action-label`;
const filter = (mode) => `#task-filters button[data-filter="${mode}"] .filter-label`;

await check("Фильтр all возвращает новый массив в исходном порядке", () => {
  const input = frozenTasks();
  const result = getVisibleTasks(input, "all");
  same(ids(result), [1, 4, 7, 10]);
  assert(result !== input, "Нужен новый массив");
});
await check("Фильтр pending выбирает невыполненные задачи", () => {
  same(ids(getVisibleTasks(frozenTasks(), "pending")), [4, 7]);
});
await check("Фильтр completed выбирает выполненные задачи", () => {
  same(ids(getVisibleTasks(frozenTasks(), "completed")), [1, 10]);
});
await check("Все три фильтра работают с пустым списком", () => {
  for (const mode of ["all", "pending", "completed"]) same(getVisibleTasks([], mode), []);
});
await check("Фильтрация не меняет входные записи и их порядок", () => {
  const input = tasks();
  const before = JSON.stringify(input);
  for (const mode of ["all", "pending", "completed"]) getVisibleTasks(input, mode);
  same(JSON.stringify(input), before);
});
await check("Карточка — li.task-card с числовым id в dataset", () => {
  const node = createTaskElement(Object.freeze(tasks()[1]));
  assert(node instanceof HTMLLIElement, "Ожидается элемент li");
  assert(node.classList.contains("task-card"), "Нет класса task-card");
  same(node.dataset.taskId, "4");
  same(requireNode(node, ".task-title").textContent, "Подготовить модель задач");
});
await check("Статус невыполненной карточки и aria-pressed согласованы", () => {
  const node = createTaskElement(tasks()[1]);
  assert(!node.classList.contains("is-completed"));
  same(requireNode(node, ".task-status").textContent, "В работе");
  same(requireNode(node, '[data-action="toggle"]').getAttribute("aria-pressed"), "false");
});
await check("Статус выполненной карточки и aria-pressed согласованы", () => {
  const node = createTaskElement(tasks()[0]);
  assert(node.classList.contains("is-completed"));
  same(requireNode(node, ".task-status").textContent, "Выполнена");
  same(requireNode(node, '[data-action="toggle"]').getAttribute("aria-pressed"), "true");
});
await check("В карточке две обычные кнопки с вложенными подписями", () => {
  const node = createTaskElement(tasks()[1]);
  same(node.querySelectorAll("button").length, 2);
  for (const kind of ["toggle", "delete"]) {
    const button = requireNode(node, `button[data-action="${kind}"]`);
    same(button.type, "button");
    assert(requireNode(button, ".action-label").textContent.trim().length > 0);
  }
  same(requireNode(node, '[data-action="toggle"] .action-label').textContent, "Выполнена");
});
await check("Все приоритеты отображаются по установленному словарю", () => {
  for (const [priority, label] of [["low", "Низкий"], ["medium", "Средний"], ["high", "Высокий"]]) {
    const node = createTaskElement({ ...tasks()[0], priority });
    same(requireNode(node, ".task-priority").textContent, label);
  }
});
await check("Название с разметкой отображается текстом", () => {
  const title = '<strong>Проверка</strong> & "кавычки"';
  const node = createTaskElement({ ...tasks()[1], title });
  const heading = requireNode(node, ".task-title");
  same(heading.textContent, title);
  same(heading.children.length, 0, "В названии не должно появляться HTML-элементов");
});
await check("Отрисовка списка создаёт карточки в исходном порядке", () => {
  const list = element("ul");
  renderTaskList(list, frozenTasks());
  same([...list.children].map((node) => Number(node.dataset.taskId)), [1, 4, 7, 10]);
});
await check("Повторная отрисовка не накапливает карточки", () => {
  const list = element("ul");
  renderTaskList(list, tasks());
  renderTaskList(list, tasks());
  same(list.children.length, 4);
});
await check("Контейнер списка и его обработчик сохраняются", () => {
  const list = element("ul");
  let clicks = 0;
  list.addEventListener("click", () => { clicks += 1; });
  renderTaskList(list, tasks());
  renderTaskList(list, tasks());
  requireNode(list, '[data-action="toggle"] .action-label').click();
  same(clicks, 1);
  assert(list.isConnected, "Нельзя заменять сам ul");
});
await check("Отрисовка пустого массива очищает прежние карточки", () => {
  const list = element("ul");
  renderTaskList(list, tasks());
  renderTaskList(list, []);
  same(list.children.length, 0);
});
await check("Сводка считается по всему списку, отдельно выводится Показано", () => {
  const root = summaryElement();
  renderSummary(root, frozenTasks(), 2);
  same(readSummary(root), ["4", "2", "2", "50.0%", "2"]);
});
await check("Пустая сводка не содержит NaN и Infinity", () => {
  const root = summaryElement();
  renderSummary(root, [], 0);
  same(readSummary(root), ["0", "0", "0", "0.0%", "0"]);
});
await check("Сообщение для полностью пустого списка", () => {
  const node = element("p");
  renderEmptyState(node, 0, 0);
  assert(!node.hidden);
  same(node.textContent, "Список задач пуст.");
});
await check("Сообщение для пустого результата фильтра", () => {
  const node = element("p");
  renderEmptyState(node, 4, 0);
  assert(!node.hidden);
  same(node.textContent, "Нет задач по выбранному фильтру.");
});
await check("Появление карточек скрывает прежнее пустое состояние", () => {
  const node = element("p");
  renderEmptyState(node, 4, 0);
  renderEmptyState(node, 4, 2);
  assert(node.hidden);
  same(node.textContent, "");
});
await check("Приложение: начальный набор и сводка", async () => {
  const doc = await freshApp();
  same(visibleIds(doc), [1, 4, 7, 10]);
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
  same(requireNode(doc, "#operation-message").textContent.trim(), "");
});
await check("Приложение: фильтр срабатывает по клику на вложенный span", async () => {
  const doc = await freshApp();
  click(doc, filter("pending"));
  same(visibleIds(doc), [4, 7]);
  same(stats(doc), ["4", "2", "2", "50.0%", "2"]);
});
await check("Приложение: активный фильтр отмечен классом и aria-pressed", async () => {
  const doc = await freshApp();
  click(doc, filter("completed"));
  const active = [...doc.querySelectorAll('#task-filters button[aria-pressed="true"]')];
  same(active.length, 1);
  same(active[0].dataset.filter, "completed");
  assert(active[0].classList.contains("is-active"));
  same(doc.querySelectorAll("#task-filters button.is-active").length, 1);
});
await check("Приложение: фильтрация не удаляет скрытые задачи", async () => {
  const doc = await freshApp();
  click(doc, filter("pending"));
  click(doc, filter("completed"));
  click(doc, filter("all"));
  same(visibleIds(doc), [1, 4, 7, 10]);
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
});
await check("Приложение: переключение по id, а не индексу массива", async () => {
  const doc = await freshApp();
  click(doc, action(4, "toggle"));
  same(requireNode(doc, `${row(4)} .task-status`).textContent, "Выполнена");
  same(stats(doc), ["4", "3", "1", "75.0%", "4"]);
  click(doc, action(4, "toggle"));
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
});
await check("Приложение: выполненная задача исчезает из фильтра В работе", async () => {
  const doc = await freshApp();
  click(doc, filter("pending"));
  click(doc, action(4, "toggle"));
  same(visibleIds(doc), [7]);
  same(stats(doc), ["4", "3", "1", "75.0%", "1"]);
});
await check("Приложение: удаление изменяет данные, а не только DOM", async () => {
  const doc = await freshApp();
  click(doc, action(7, "delete"));
  click(doc, filter("completed"));
  click(doc, filter("all"));
  same(visibleIds(doc), [1, 4, 10]);
  same(stats(doc), ["3", "2", "1", "66.7%", "3"]);
});
await check("Приложение: клик по названию не изменяет данные", async () => {
  const doc = await freshApp();
  click(doc, `${row(4)} .task-title`);
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
});
await check("Приложение: после перерисовок одно нажатие — одно изменение", async () => {
  const doc = await freshApp();
  for (const mode of ["pending", "all", "completed", "all", "pending", "all"]) click(doc, filter(mode));
  click(doc, action(4, "toggle"));
  same(stats(doc), ["4", "3", "1", "75.0%", "4"]);
});
await check("Приложение: удаление всех записей и нулевая сводка", async () => {
  const doc = await freshApp();
  for (const id of [1, 4, 7, 10]) click(doc, action(id, "delete"));
  same(visibleIds(doc), []);
  same(stats(doc), ["0", "0", "0", "0.0%", "0"]);
  const message = requireNode(doc, "#empty-message");
  assert(!message.hidden);
  same(message.textContent, "Список задач пуст.");
  click(doc, filter("pending"));
  same(message.textContent, "Список задач пуст.");
});
await check("Приложение: нет совпадений — не то же самое, что нет задач", async () => {
  const doc = await freshApp();
  click(doc, action(4, "toggle"));
  click(doc, action(7, "toggle"));
  click(doc, filter("pending"));
  same(visibleIds(doc), []);
  same(stats(doc), ["4", "4", "0", "100.0%", "0"]);
  same(requireNode(doc, "#empty-message").textContent, "Нет задач по выбранному фильтру.");
  assert(!requireNode(doc, "#empty-message").hidden);
});
await check("Приложение: неизвестный числовой id не меняет данные", async () => {
  const doc = await freshApp();
  const card = requireNode(doc, row(4));
  card.dataset.taskId = "777";
  click(card, '[data-action="delete"] .action-label');
  assert(requireNode(doc, "#operation-message").textContent.trim().length > 0);
  click(doc, filter("all"));
  same(visibleIds(doc), [1, 4, 7, 10]);
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
});
await check("Приложение: id 4abc не превращается в 4", async () => {
  const doc = await freshApp();
  const card = requireNode(doc, row(4));
  card.dataset.taskId = "4abc";
  click(card, '[data-action="toggle"] .action-label');
  assert(requireNode(doc, "#operation-message").textContent.trim().length > 0);
  click(doc, filter("all"));
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
});
await check("Приложение: неизвестное действие игнорируется", async () => {
  const doc = await freshApp();
  const button = requireNode(doc, `${row(4)} [data-action="toggle"]`);
  button.dataset.action = "archive";
  click(button, ".action-label");
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
});
await check("Приложение: после изменения сохраняется клавиатурный фокус", async () => {
  const doc = await freshApp();
  click(doc, action(4, "toggle"));
  same(doc.activeElement?.dataset.action, "toggle");
  same(doc.activeElement?.closest("[data-task-id]")?.dataset.taskId, "4");
  click(doc, filter("pending"));
  click(doc, action(7, "toggle"));
  same(doc.activeElement?.dataset.filter, "pending");
});
await check("Приложение: новая загрузка возвращает исходное состояние", async () => {
  let doc = await freshApp();
  click(doc, action(7, "delete"));
  doc = await freshApp();
  same(visibleIds(doc), [1, 4, 7, 10]);
  same(stats(doc), ["4", "2", "2", "50.0%", "4"]);
});

fixtureRoot.replaceChildren();
const conclusion = `Всего: ${passed + failed}. Пройдено: ${passed}. Ошибок: ${failed}.`;
summary.textContent = conclusion;
log.textContent = `${transcript.join("\n")}\n\n${conclusion}`;
document.documentElement.dataset.checksDone = "true";
document.documentElement.dataset.checksPassed = String(passed);
document.documentElement.dataset.checksFailed = String(failed);
