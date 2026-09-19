// Проверки новых модулей ПР4. Установка пакетов не требуется.
import assert from "node:assert/strict";
import { updateTask } from "../src/task-service.js";
import { validateTaskDraft } from "../src/form-validation.js";
import {
  STORAGE_VERSION,
  isValidTaskList,
  loadTasks,
  removeSavedTasks,
  saveTasks,
} from "../src/task-storage.js";

let passed = 0;
let failed = 0;

function check(name, action) {
  try {
    action();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error.message);
  }
}

function fixture() {
  return [
    { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
    { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
    { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
    { id: 10, title: "Оформить README", completed: true, priority: "medium" },
  ];
}

function expectFailure(result) {
  assert.ok(result && typeof result === "object", "Нужен объект результата");
  assert.equal(result.ok, false, "Ожидается ok: false");
}

function expectTasks(result) {
  assert.ok(result && typeof result === "object", "Нужен объект результата");
  assert.equal(result.ok, true, "Ожидается ok: true");
  assert.ok(Array.isArray(result.tasks), "Нужно поле tasks с массивом");
  return result.tasks;
}

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.writes = 0;
    this.removes = 0;
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.writes += 1;
    this.values.set(String(key), String(value));
  }
  removeItem(key) {
    this.removes += 1;
    this.values.delete(String(key));
  }
}

check("01. updateTask изменяет название и приоритет выбранной задачи", () => {
  const source = fixture();
  const result = expectTasks(updateTask(source, 4, "Новая формулировка", "low"));
  assert.deepEqual(result[1], {
    id: 4, title: "Новая формулировка", completed: false, priority: "low",
  });
  assert.deepEqual(result.map((task) => task.id), [1, 4, 7, 10]);
});

check("02. updateTask нормализует название и сохраняет completed", () => {
  const result = expectTasks(updateTask(fixture(), 1, "  Обновлённая задача  ", "high"));
  assert.equal(result[0].title, "Обновлённая задача");
  assert.equal(result[0].completed, true);
});

check("03. updateTask не изменяет входной массив и объекты", () => {
  const source = Object.freeze(fixture().map((task) => Object.freeze(task)));
  const result = expectTasks(updateTask(source, 7, "Другая задача", "medium"));
  assert.notEqual(result, source);
  assert.notEqual(result[2], source[2]);
  assert.equal(result[0], source[0]);
  assert.equal(source[2].title, "Проверить методы массивов");
});

check("04. updateTask отклоняет некорректный и отсутствующий id", () => {
  for (const id of [0, -1, 1.5, "4", 777, Number.MAX_SAFE_INTEGER + 1]) {
    expectFailure(updateTask(fixture(), id, "Название", "low"));
  }
});

check("05. updateTask отклоняет некорректные название и приоритет", () => {
  for (const title of ["", "   ", "x".repeat(101), null]) {
    expectFailure(updateTask(fixture(), 4, title, "low"));
  }
  for (const priority of ["urgent", "HIGH", "", null]) {
    expectFailure(updateTask(fixture(), 4, "Название", priority));
  }
});

check("06. Валидация создания нормализует поля", () => {
  assert.deepEqual(validateTaskDraft(
    { id: "20", title: "  Изучить localStorage  ", priority: "high" },
    fixture(),
  ), {
    ok: true,
    value: { id: 20, title: "Изучить localStorage", priority: "high" },
  });
});

check("07. Валидация отклоняет некорректные id", () => {
  for (const id of ["", "0", "-1", "1.5", "4abc", Number.MAX_SAFE_INTEGER + 1]) {
    const result = validateTaskDraft({ id, title: "Название", priority: "low" }, fixture());
    expectFailure(result);
    assert.equal(typeof result.errors.id, "string");
  }
});

check("08. Валидация отклоняет повторяющийся id при создании", () => {
  const result = validateTaskDraft({ id: "4", title: "Название", priority: "low" }, fixture());
  expectFailure(result);
  assert.ok(result.errors.id.trim().length > 0);
});

check("09. Валидация проверяет название после trim", () => {
  for (const title of ["", "   ", "x".repeat(101), null]) {
    const result = validateTaskDraft({ id: 20, title, priority: "low" }, fixture());
    expectFailure(result);
    assert.equal(typeof result.errors.title, "string");
  }
  assert.equal(validateTaskDraft({ id: 20, title: "x".repeat(100), priority: "low" }, fixture()).ok, true);
});

check("10. Валидация принимает только три приоритета", () => {
  for (const priority of ["low", "medium", "high"]) {
    assert.equal(validateTaskDraft({ id: 20, title: "Название", priority }, fixture()).ok, true);
  }
  for (const priority of ["urgent", "HIGH", " high ", "", null]) {
    const result = validateTaskDraft({ id: 20, title: "Название", priority }, fixture());
    expectFailure(result);
    assert.equal(typeof result.errors.priority, "string");
  }
});

check("11. В режиме редактирования используется editingId", () => {
  assert.deepEqual(validateTaskDraft(
    { id: "другой id", title: "  Обновить форму  ", priority: "medium" },
    fixture(),
    4,
  ), {
    ok: true,
    value: { id: 4, title: "Обновить форму", priority: "medium" },
  });
});

check("12. Редактирование отсутствующей задачи отклоняется", () => {
  const result = validateTaskDraft(
    { id: 777, title: "Название", priority: "medium" }, fixture(), 777,
  );
  expectFailure(result);
  assert.equal(typeof result.errors.id, "string");
});

check("13. Валидация не изменяет draft и список", () => {
  const draft = Object.freeze({ id: "20", title: "  Название  ", priority: "low" });
  const tasks = Object.freeze(fixture().map((task) => Object.freeze(task)));
  assert.equal(validateTaskDraft(draft, tasks).ok, true);
  assert.equal(draft.title, "  Название  ");
  assert.equal(tasks.length, 4);
});

check("14. Проверка схемы принимает корректный список", () => {
  assert.equal(isValidTaskList(fixture()), true);
  assert.equal(isValidTaskList([]), true);
});

check("15. Проверка схемы отклоняет неверную структуру", () => {
  const invalid = [
    null,
    {},
    [{ id: 1, title: "Название", completed: "false", priority: "low" }],
    [{ id: 0, title: "Название", completed: false, priority: "low" }],
    [{ id: 1, title: "   ", completed: false, priority: "low" }],
    [{ id: 1, title: "Название", completed: false, priority: "urgent" }],
    [
      { id: 1, title: "Первая", completed: false, priority: "low" },
      { id: 1, title: "Вторая", completed: true, priority: "high" },
    ],
  ];
  for (const value of invalid) assert.equal(isValidTaskList(value), false);
});

check("16. Отсутствующая запись возвращает независимую копию исходных данных", () => {
  const fallback = fixture();
  const result = loadTasks(new MemoryStorage(), "tasks", fallback);
  assert.equal(result.ok, true);
  assert.equal(result.source, "initial");
  assert.deepEqual(result.tasks, fallback);
  assert.notEqual(result.tasks, fallback);
  assert.notEqual(result.tasks[0], fallback[0]);
});

check("17. Корректная запись восстанавливается из хранилища", () => {
  const saved = fixture().slice(1);
  const storage = new MemoryStorage({
    tasks: JSON.stringify({ version: STORAGE_VERSION, tasks: saved }),
  });
  const result = loadTasks(storage, "tasks", fixture());
  assert.equal(result.ok, true);
  assert.equal(result.source, "storage");
  assert.deepEqual(result.tasks, saved);
  assert.notEqual(result.tasks, saved);
});

check("18. Повреждённый JSON приводит к безопасному fallback", () => {
  const result = loadTasks(new MemoryStorage({ tasks: "{broken" }), "tasks", fixture());
  expectFailure(result);
  assert.equal(result.source, "fallback");
  assert.deepEqual(result.tasks, fixture());
  assert.equal(typeof result.error, "string");
});

check("19. Неизвестная версия приводит к безопасному fallback", () => {
  const storage = new MemoryStorage({ tasks: JSON.stringify({ version: 999, tasks: fixture() }) });
  const result = loadTasks(storage, "tasks", fixture());
  expectFailure(result);
  assert.equal(result.source, "fallback");
});

check("20. Некорректные задачи из JSON не принимаются", () => {
  const storage = new MemoryStorage({
    tasks: JSON.stringify({
      version: STORAGE_VERSION,
      tasks: [{ id: 1, title: "Название", completed: "нет", priority: "low" }],
    }),
  });
  const result = loadTasks(storage, "tasks", fixture());
  expectFailure(result);
  assert.deepEqual(result.tasks, fixture());
});

check("21. Ошибка getItem перехватывается", () => {
  const storage = { getItem() { throw new Error("blocked"); } };
  const result = loadTasks(storage, "tasks", fixture());
  expectFailure(result);
  assert.equal(result.source, "fallback");
  assert.deepEqual(result.tasks, fixture());
});

check("22. Сохранение записывает версию и задачи", () => {
  const storage = new MemoryStorage();
  assert.deepEqual(saveTasks(storage, "tasks", fixture()), { ok: true });
  assert.deepEqual(JSON.parse(storage.getItem("tasks")), {
    version: STORAGE_VERSION,
    tasks: fixture(),
  });
  assert.equal(storage.writes, 1);
});

check("23. Некорректный список не записывается", () => {
  const storage = new MemoryStorage();
  const result = saveTasks(storage, "tasks", [{ id: 1 }]);
  expectFailure(result);
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem("tasks"), null);
});

check("24. Ошибка setItem перехватывается", () => {
  const storage = {
    setItem() { throw new Error("quota"); },
  };
  expectFailure(saveTasks(storage, "tasks", fixture()));
});

check("25. Удаляется только переданный ключ", () => {
  const storage = new MemoryStorage({ tasks: "value", other: "keep" });
  assert.deepEqual(removeSavedTasks(storage, "tasks"), { ok: true });
  assert.equal(storage.getItem("tasks"), null);
  assert.equal(storage.getItem("other"), "keep");
  assert.equal(storage.removes, 1);
});

check("26. Ошибка removeItem перехватывается", () => {
  const storage = {
    removeItem() { throw new Error("blocked"); },
  };
  expectFailure(removeSavedTasks(storage, "tasks"));
});

check("27. Результат загрузки не разделяет объекты с fallback", () => {
  const fallback = fixture();
  const result = loadTasks(new MemoryStorage(), "tasks", fallback);
  result.tasks[0].title = "Изменено";
  assert.equal(fallback[0].title, "Изучить функции");
});

console.log(`\nПроверок пройдено: ${passed}; не пройдено: ${failed}.`);
if (failed > 0) process.exitCode = 1;
