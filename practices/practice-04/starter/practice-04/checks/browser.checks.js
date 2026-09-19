// Браузерные проверки ПР4. Открывать checks.html через локальный сервер.
import { getVisibleTasks } from "../src/task-selectors.js";
import {
  createTaskElement,
  renderEmptyState,
  renderSummary,
  renderTaskList,
} from "../src/task-view.js";

const results = document.querySelector("#check-results");
const log = document.querySelector("#check-log");
const summary = document.querySelector("#check-summary");
const fixtureRoot = document.querySelector("#test-fixture");
const frame = document.querySelector("#test-frame");
const transcript = [];
let passed = 0;
let failed = 0;
let loadNumber = 0;

const keyFor = (dataset = "demo") => `tip-js-practice-04:checks:${dataset}`;

function assert(condition, message = "Условие не выполнено") {
  if (!condition) throw new Error(message);
}

function same(actual, expected, message = "Результаты отличаются") {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}: получено ${JSON.stringify(actual)}, ожидалось ${JSON.stringify(expected)}`,
  );
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

function requireNode(root, selector) {
  const node = root.querySelector(selector);
  assert(node, `Не найден элемент: ${selector}`);
  return node;
}

function visibleIds(doc) {
  return [...doc.querySelectorAll("#task-list > [data-task-id]")]
    .map((node) => Number(node.dataset.taskId));
}

function readStats(doc) {
  return ["total", "completed", "pending", "progress", "visible"]
    .map((name) => requireNode(doc, `[data-stat="${name}"]`).textContent.trim());
}

function click(doc, selector) {
  requireNode(doc, selector).click();
}

function inputValue(doc, selector, value) {
  const input = requireNode(doc, selector);
  input.value = value;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event("input", { bubbles: true }));
}

function submitForm(doc, { id, title, priority }) {
  if (id !== undefined) inputValue(doc, "#task-id", String(id));
  if (title !== undefined) inputValue(doc, "#task-title", title);
  if (priority !== undefined) inputValue(doc, "#task-priority", priority);
  requireNode(doc, "#task-form").requestSubmit();
}

function storedTasks(dataset = "demo") {
  const raw = localStorage.getItem(keyFor(dataset));
  assert(raw !== null, "Ожидалась запись в localStorage");
  return JSON.parse(raw).tasks;
}

async function freshApp({ dataset = "demo", keepStorage = false, raw } = {}) {
  loadNumber += 1;
  const key = keyFor(dataset);
  if (!keepStorage) localStorage.removeItem(key);
  if (raw !== undefined) localStorage.setItem(key, raw);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Приложение не загрузилось за 10 секунд"));
    }, 10000);

    frame.addEventListener("load", () => {
      clearTimeout(timer);
      const doc = frame.contentDocument;
      if (!doc?.querySelector("#task-form")) {
        reject(new Error("В iframe не найдена страница приложения"));
        return;
      }
      resolve(doc);
    }, { once: true });

    const datasetPart = dataset === "variant" ? "&dataset=variant" : "";
    frame.src = `./index.html?mode=check&run=${loadNumber}${datasetPart}`;
  });
}

await check("Фильтры ПР3 сохраняют порядок и не изменяют вход", () => {
  const source = frozenTasks();
  same(getVisibleTasks(source, "all").map((task) => task.id), [1, 4, 7, 10]);
  same(getVisibleTasks(source, "pending").map((task) => task.id), [4, 7]);
  same(getVisibleTasks(source, "completed").map((task) => task.id), [1, 10]);
  same(source.map((task) => task.id), [1, 4, 7, 10]);
});

await check("Карточка содержит toggle, edit и delete", () => {
  const node = createTaskElement(tasks()[1]);
  assert(node instanceof HTMLLIElement, "Ожидается li");
  assert(node.classList.contains("task-card"), "Нет класса task-card");
  same(node.dataset.taskId, "4");
  for (const action of ["toggle", "edit", "delete"]) {
    const button = requireNode(node, `button[data-action="${action}"]`);
    same(button.type, "button");
    assert(requireNode(button, ".action-label").textContent.trim().length > 0);
  }
  same(node.querySelectorAll("button").length, 3);
  same(requireNode(node, '[data-action="edit"] .action-label').textContent, "Изменить");
});

await check("Название задачи выводится как текст", () => {
  const title = '<img src=x onerror="alert(1)"> & проверка';
  const node = createTaskElement({ ...tasks()[0], title });
  const heading = requireNode(node, ".task-title");
  same(heading.textContent, title);
  same(heading.children.length, 0);
});

await check("Повторная отрисовка списка не накапливает карточки", () => {
  const list = element("ul");
  renderTaskList(list, tasks());
  renderTaskList(list, tasks().slice(1));
  same([...list.children].map((node) => Number(node.dataset.taskId)), [4, 7, 10]);
});

await check("Сводка использует полный список и отдельный visibleCount", () => {
  const root = summaryElement();
  renderSummary(root, frozenTasks(), 2);
  same(["total", "completed", "pending", "progress", "visible"].map(
    (name) => requireNode(root, `[data-stat="${name}"]`).textContent,
  ), ["4", "2", "2", "50.0%", "2"]);
});

await check("Пустые состояния различают список и фильтр", () => {
  const node = element("p");
  renderEmptyState(node, 0, 0);
  assert(!node.hidden);
  same(node.textContent, "Список задач пуст.");
  renderEmptyState(node, 4, 0);
  same(node.textContent, "Нет задач по выбранному фильтру.");
  renderEmptyState(node, 4, 2);
  assert(node.hidden);
  same(node.textContent, "");
});

await check("Приложение запускается с исходным набором", async () => {
  const doc = await freshApp();
  same(visibleIds(doc), [1, 4, 7, 10]);
  same(readStats(doc), ["4", "2", "2", "50.0%", "4"]);
  assert(requireNode(doc, "#storage-status").textContent.includes("исходн"));
  same(localStorage.getItem(keyFor()), null);
});

await check("Корректная форма добавляет задачу и сохраняет данные", async () => {
  const doc = await freshApp();
  submitForm(doc, { id: 20, title: "  Изучить localStorage  ", priority: "high" });
  same(visibleIds(doc), [1, 4, 7, 10, 20]);
  same(requireNode(doc, '[data-task-id="20"] .task-title').textContent, "Изучить localStorage");
  same(storedTasks().map((task) => task.id), [1, 4, 7, 10, 20]);
});

await check("Повторяющийся id отклоняется без записи", async () => {
  const doc = await freshApp();
  submitForm(doc, { id: 4, title: "Дубликат", priority: "low" });
  same(visibleIds(doc), [1, 4, 7, 10]);
  assert(requireNode(doc, "#task-id").getAttribute("aria-invalid") === "true");
  assert(requireNode(doc, "#task-id-error").textContent.trim().length > 0);
  same(localStorage.getItem(keyFor()), null);
});

await check("Название из пробелов отклоняется прикладной проверкой", async () => {
  const doc = await freshApp();
  submitForm(doc, { id: 20, title: "   ", priority: "low" });
  same(visibleIds(doc), [1, 4, 7, 10]);
  assert(requireNode(doc, "#task-title").getAttribute("aria-invalid") === "true");
  assert(requireNode(doc, "#task-title-error").textContent.trim().length > 0);
});

await check("Нативные ограничения не пропускают пустую форму", async () => {
  const doc = await freshApp();
  requireNode(doc, "#task-form").requestSubmit();
  same(visibleIds(doc), [1, 4, 7, 10]);
  assert(!requireNode(doc, "#task-id").validity.valid);
  same(localStorage.getItem(keyFor()), null);
});

await check("Кнопка edit заполняет форму и блокирует id", async () => {
  const doc = await freshApp();
  click(doc, '[data-task-id="4"] [data-action="edit"] .action-label');
  same(requireNode(doc, "#task-id").value, "4");
  assert(requireNode(doc, "#task-id").disabled);
  same(requireNode(doc, "#task-title").value, "Подготовить модель задач");
  same(requireNode(doc, "#task-priority").value, "high");
  same(requireNode(doc, "#form-submit").textContent, "Сохранить изменения");
  assert(!requireNode(doc, "#cancel-edit").hidden);
});

await check("Редактирование меняет title и priority, сохраняя completed", async () => {
  const doc = await freshApp();
  click(doc, '[data-task-id="1"] [data-action="edit"] .action-label');
  submitForm(doc, { title: "  Изучить формы  ", priority: "low" });
  same(requireNode(doc, '[data-task-id="1"] .task-title').textContent, "Изучить формы");
  same(requireNode(doc, '[data-task-id="1"] .task-priority').textContent, "Низкий");
  assert(requireNode(doc, '[data-task-id="1"]').classList.contains("is-completed"));
  const saved = storedTasks().find((task) => task.id === 1);
  same(saved, { id: 1, title: "Изучить формы", completed: true, priority: "low" });
});

await check("Отмена редактирования возвращает режим создания", async () => {
  const doc = await freshApp();
  click(doc, '[data-task-id="7"] [data-action="edit"] .action-label');
  click(doc, "#cancel-edit");
  assert(!requireNode(doc, "#task-id").disabled);
  same(requireNode(doc, "#task-id").value, "");
  same(requireNode(doc, "#task-title").value, "");
  same(requireNode(doc, "#form-submit").textContent, "Добавить задачу");
  assert(requireNode(doc, "#cancel-edit").hidden);
});

await check("Успешная отправка очищает ошибки и форму", async () => {
  const doc = await freshApp();
  submitForm(doc, { id: 4, title: "Дубликат", priority: "low" });
  inputValue(doc, "#task-id", "20");
  inputValue(doc, "#task-title", "Новая задача");
  requireNode(doc, "#task-form").requestSubmit();
  same(visibleIds(doc), [1, 4, 7, 10, 20]);
  same(requireNode(doc, "#task-id-error").textContent, "");
  same(requireNode(doc, "#task-id").value, "");
  same(requireNode(doc, "#task-title").value, "");
});

await check("Изменение статуса сохраняется", async () => {
  const doc = await freshApp();
  click(doc, '[data-task-id="4"] [data-action="toggle"] .action-label');
  assert(requireNode(doc, '[data-task-id="4"]').classList.contains("is-completed"));
  assert(storedTasks().find((task) => task.id === 4).completed);
  same(readStats(doc), ["4", "3", "1", "75.0%", "4"]);
});

await check("Удаление сохраняется", async () => {
  const doc = await freshApp();
  click(doc, '[data-task-id="7"] [data-action="delete"] .action-label');
  same(visibleIds(doc), [1, 4, 10]);
  same(storedTasks().map((task) => task.id), [1, 4, 10]);
});

await check("Фильтр не записывается, но сохраняется после изменения данных", async () => {
  const doc = await freshApp();
  click(doc, '#task-filters [data-filter="pending"] .filter-label');
  same(localStorage.getItem(keyFor()), null);
  click(doc, '[data-task-id="4"] [data-action="toggle"] .action-label');
  same(visibleIds(doc), [7]);
  same(storedTasks().map((task) => task.id), [1, 4, 7, 10]);
});

await check("Перезагрузка восстанавливает сохранённые задачи", async () => {
  let doc = await freshApp();
  submitForm(doc, { id: 20, title: "Сохранённая задача", priority: "medium" });
  doc = await freshApp({ keepStorage: true });
  same(visibleIds(doc), [1, 4, 7, 10, 20]);
  assert(requireNode(doc, "#storage-status").textContent.includes("восстановлены"));
});

await check("Сброс удаляет ключ и восстанавливает исходный набор", async () => {
  const doc = await freshApp();
  submitForm(doc, { id: 20, title: "Временная задача", priority: "medium" });
  click(doc, "#reset-data");
  same(visibleIds(doc), [1, 4, 7, 10]);
  same(readStats(doc), ["4", "2", "2", "50.0%", "4"]);
  same(localStorage.getItem(keyFor()), null);
});

await check("Повреждённый JSON не ломает запуск", async () => {
  const doc = await freshApp({ raw: "{broken-json" });
  same(visibleIds(doc), [1, 4, 7, 10]);
  assert(requireNode(doc, "#storage-status").classList.contains("is-warning"));
  assert(requireNode(doc, "#storage-status").textContent.trim().length > 0);
});

await check("Некорректная схема из storage заменяется исходным набором", async () => {
  const raw = JSON.stringify({
    version: 1,
    tasks: [{ id: 1, title: "Ошибка", completed: "нет", priority: "low" }],
  });
  const doc = await freshApp({ raw });
  same(visibleIds(doc), [1, 4, 7, 10]);
  assert(requireNode(doc, "#storage-status").classList.contains("is-warning"));
});

await check("Общий и индивидуальный наборы используют разные ключи", async () => {
  localStorage.setItem(keyFor("demo"), JSON.stringify({
    version: 1,
    tasks: [{ id: 91, title: "Общий тест", completed: false, priority: "low" }],
  }));
  localStorage.setItem(keyFor("variant"), JSON.stringify({
    version: 1,
    tasks: [{ id: 92, title: "Тест варианта", completed: true, priority: "high" }],
  }));
  let doc = await freshApp({ dataset: "demo", keepStorage: true });
  same(visibleIds(doc), [91]);
  doc = await freshApp({ dataset: "variant", keepStorage: true });
  same(visibleIds(doc), [92]);
});

localStorage.removeItem(keyFor("demo"));
localStorage.removeItem(keyFor("variant"));

summary.textContent = `Всего: ${passed + failed}. Пройдено: ${passed}. Ошибок: ${failed}.`;
summary.className = failed === 0 ? "check-pass" : "check-fail";
