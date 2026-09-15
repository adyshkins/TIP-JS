// Готовый проверочный сценарий. Установка пакетов не требуется.
// В этом файле нет реализации функций task-service.js.
// Первоначально проверки не проходят: функции в заготовке ещё не реализованы.
import assert from "node:assert/strict";
import {
  createTask, findTaskById, getPendingTasks, getTaskTitles, getTaskStats,
  addTask, setTaskCompleted, renameTask, removeTask,
} from "./src/task-service.js";

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

// Каждый вызов создаёт новый независимый набор данных.
function fixture() {
  return [
    { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
    { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
    { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
    { id: 10, title: "Оформить README", completed: true, priority: "medium" },
  ];
}

function copyTasks(tasks) {
  return tasks.map((task) => ({ ...task }));
}

function expectFailure(result) {
  assert.ok(result !== null && typeof result === "object", "Нужен объект результата");
  assert.equal(result.ok, false, "Ожидается ok: false");
  assert.equal(typeof result.error, "string", "error должен быть строкой");
  assert.ok(result.error.trim().length > 0, "Сообщение об ошибке не должно быть пустым");
}

function expectTask(result) {
  assert.ok(result !== null && typeof result === "object", "Нужен объект результата");
  assert.equal(result.ok, true, "Ожидается ok: true");
  assert.ok(result.task !== null && typeof result.task === "object", "Нужно поле task");
  return result.task;
}

function expectTasks(result) {
  assert.ok(result !== null && typeof result === "object", "Нужен объект результата");
  assert.equal(result.ok, true, "Ожидается ok: true");
  assert.ok(Array.isArray(result.tasks), "Нужно поле tasks с массивом");
  return result.tasks;
}

const invalidIds = [0, -1, 1.5, "4", NaN, Infinity, null, undefined, Number.MAX_SAFE_INTEGER + 1];
const invalidTitles = ["", "   ", "x".repeat(101), 42, null, undefined];

check("01. Создание задачи с явным приоритетом", () => {
  assert.deepEqual(expectTask(createTask(20, "Новая задача", "high")), {
    id: 20, title: "Новая задача", completed: false, priority: "high",
  });
});

check("02. Приоритет по умолчанию", () => {
  assert.equal(expectTask(createTask(20, "Новая задача")).priority, "medium");
  assert.equal(expectTask(createTask(20, "Новая задача", undefined)).priority, "medium");
});

check("03. Удаление краевых пробелов без изменения внутренних", () => {
  assert.equal(expectTask(createTask(20, "  Проверить  данные  ", "low")).title, "Проверить  данные");
});

check("04. Граничные длины названия и положительный безопасный id", () => {
  assert.equal(expectTask(createTask(1, "x")).title.length, 1);
  assert.equal(expectTask(createTask(2, "x".repeat(100))).title.length, 100);
  assert.equal(expectTask(createTask(Number.MAX_SAFE_INTEGER, "Граница id")).id, Number.MAX_SAFE_INTEGER);
});

check("05. Некорректные названия при создании", () => {
  for (const title of invalidTitles) expectFailure(createTask(20, title));
});

check("06. Некорректные идентификаторы при создании", () => {
  for (const id of invalidIds) expectFailure(createTask(id, "Новая задача"));
});

check("07. Все допустимые приоритеты и отклонение недопустимых", () => {
  for (const priority of ["low", "medium", "high"]) {
    assert.equal(expectTask(createTask(20, "Новая задача", priority)).priority, priority);
  }
  for (const priority of ["urgent", "HIGH", "", " high ", null, 1]) {
    expectFailure(createTask(20, "Новая задача", priority));
  }
});

check("08. Каждый вызов createTask возвращает новый объект", () => {
  const first = expectTask(createTask(20, "Новая задача"));
  const second = expectTask(createTask(20, "Новая задача"));
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
});

check("09. Поиск по id, а не по индексу", () => {
  const tasks = fixture();
  assert.equal(findTaskById(tasks, 4), tasks[1]);
  assert.equal(findTaskById(tasks, 10), tasks[3]);
});

check("10. Отсутствующая задача и пустой массив при поиске", () => {
  assert.equal(findTaskById(fixture(), 777), undefined);
  assert.equal(findTaskById([], 1), undefined);
});

check("11. Поиск не преобразует строковый id в число", () => {
  assert.equal(findTaskById(fixture(), "4"), undefined);
});

check("12. Получение невыполненных задач", () => {
  const tasks = fixture();
  const pending = getPendingTasks(tasks);
  assert.deepEqual(pending.map((task) => task.id), [4, 7]);
  assert.notEqual(pending, tasks);
  assert.deepEqual(tasks, fixture());
});

check("13. Пустой список, все выполнены и все не выполнены", () => {
  const empty = [];
  assert.deepEqual(getPendingTasks(empty), []);
  assert.notEqual(getPendingTasks(empty), empty);
  assert.deepEqual(getPendingTasks(fixture().map((task) => ({ ...task, completed: true }))), []);
  const allPending = fixture().map((task) => ({ ...task, completed: false }));
  const result = getPendingTasks(allPending);
  assert.deepEqual(result, allPending);
  assert.notEqual(result, allPending);
});

check("14. Названия в исходном порядке и пустой список", () => {
  const tasks = fixture();
  assert.deepEqual(getTaskTitles(tasks), [
    "Изучить функции", "Подготовить модель задач", "Проверить методы массивов", "Оформить README",
  ]);
  assert.deepEqual(getTaskTitles([]), []);
});

check("15. Сводка по общему набору", () => {
  assert.deepEqual(getTaskStats(fixture()), { total: 4, completed: 2, pending: 2, progress: 50 });
});

check("16. Сводка по пустому списку", () => {
  assert.deepEqual(getTaskStats([]), { total: 0, completed: 0, pending: 0, progress: 0 });
});

check("17. Сводка: ничего не выполнено и выполнено всё", () => {
  assert.deepEqual(getTaskStats(fixture().map((task) => ({ ...task, completed: false }))),
    { total: 4, completed: 0, pending: 4, progress: 0 });
  assert.deepEqual(getTaskStats(fixture().map((task) => ({ ...task, completed: true }))),
    { total: 4, completed: 4, pending: 0, progress: 100 });
});

check("18. Процент остаётся числом без предварительного округления", () => {
  const result = getTaskStats(fixture().slice(0, 3));
  assert.equal(typeof result.progress, "number");
  assert.ok(Math.abs(result.progress - 100 / 3) < 1e-10);
  assert.equal(result.progress.toFixed(1), "33.3");
});

check("19. Добавление в конец без изменения входного массива", () => {
  const tasks = fixture();
  const before = copyTasks(tasks);
  const next = expectTasks(addTask(tasks, 20, "  Добавить проверку  ", "high"));
  assert.notEqual(next, tasks);
  assert.deepEqual(next.map((task) => task.id), [1, 4, 7, 10, 20]);
  assert.deepEqual(next[4], { id: 20, title: "Добавить проверку", completed: false, priority: "high" });
  assert.deepEqual(next.slice(0, 4), before);
  assert.deepEqual(tasks, before);
});

check("20. Добавление в пустой список с приоритетом по умолчанию", () => {
  const tasks = [];
  const next = expectTasks(addTask(tasks, 20, "Первая задача"));
  assert.equal(next.length, 1);
  assert.equal(next[0].priority, "medium");
  assert.notEqual(next, tasks);
  assert.deepEqual(tasks, []);
});

check("21. Повторяющийся id отклоняется", () => {
  const tasks = fixture();
  expectFailure(addTask(tasks, 4, "Другая задача"));
  assert.deepEqual(tasks, fixture());
});

check("22. Добавление не обходит проверки createTask", () => {
  const tasks = fixture();
  for (const id of invalidIds) expectFailure(addTask(tasks, id, "Новая задача"));
  for (const title of invalidTitles) expectFailure(addTask(tasks, 20, title));
  for (const priority of ["urgent", null, 1]) expectFailure(addTask(tasks, 20, "Новая задача", priority));
  assert.deepEqual(tasks, fixture());
});

check("23. Изменение completed в обе стороны", () => {
  const tasks = fixture();
  const next = expectTasks(setTaskCompleted(tasks, 4, true));
  assert.deepEqual(next[1], { ...tasks[1], completed: true });
  assert.notEqual(next, tasks);
  assert.notEqual(next[1], tasks[1]);
  assert.deepEqual(tasks, fixture());
  const restored = expectTasks(setTaskCompleted(next, 4, false));
  assert.equal(restored[1].completed, false);
  assert.equal(next[1].completed, true);
});

check("24. completed принимает только boolean", () => {
  const tasks = fixture();
  for (const value of ["true", "false", 1, 0, null, undefined]) {
    expectFailure(setTaskCompleted(tasks, 4, value));
  }
  assert.deepEqual(tasks, fixture());
});

check("25. Некорректный или отсутствующий id при изменении статуса", () => {
  const tasks = fixture();
  for (const id of [...invalidIds, 777]) expectFailure(setTaskCompleted(tasks, id, true));
  expectFailure(setTaskCompleted([], 4, true));
  assert.deepEqual(tasks, fixture());
});

check("26. Повторная установка статуса создаёт новый результат", () => {
  const tasks = fixture();
  const next = expectTasks(setTaskCompleted(tasks, 1, true));
  assert.notEqual(next, tasks);
  assert.notEqual(next[0], tasks[0]);
  assert.deepEqual(next, tasks);
});

check("27. Переименование сохраняет остальные поля", () => {
  const tasks = fixture();
  const next = expectTasks(renameTask(tasks, 10, "  Подготовить инструкцию запуска  "));
  assert.deepEqual(next[3], { ...tasks[3], title: "Подготовить инструкцию запуска" });
  assert.notEqual(next, tasks);
  assert.notEqual(next[3], tasks[3]);
  assert.deepEqual(tasks, fixture());
  const same = expectTasks(renameTask(tasks, 10, tasks[3].title));
  assert.notEqual(same, tasks);
  assert.notEqual(same[3], tasks[3]);
  assert.deepEqual(same, tasks);
});

check("28. Проверки названия при переименовании", () => {
  const tasks = fixture();
  for (const title of invalidTitles) expectFailure(renameTask(tasks, 10, title));
  assert.equal(expectTasks(renameTask(tasks, 10, "x"))[3].title, "x");
  assert.equal(expectTasks(renameTask(tasks, 10, "x".repeat(100)))[3].title.length, 100);
  assert.deepEqual(tasks, fixture());
});

check("29. Некорректный или отсутствующий id при переименовании", () => {
  const tasks = fixture();
  for (const id of [...invalidIds, 777]) expectFailure(renameTask(tasks, id, "Название"));
  expectFailure(renameTask([], 10, "Название"));
  assert.deepEqual(tasks, fixture());
});

check("30. Удаление по id с сохранением порядка", () => {
  const tasks = fixture();
  const next = expectTasks(removeTask(tasks, 7));
  assert.deepEqual(next.map((task) => task.id), [1, 4, 10]);
  assert.deepEqual(next, [tasks[0], tasks[1], tasks[3]]);
  assert.notEqual(next, tasks);
  assert.deepEqual(tasks, fixture());
});

check("31. Удаление единственной записи", () => {
  const tasks = fixture().slice(0, 1);
  const next = expectTasks(removeTask(tasks, 1));
  assert.deepEqual(next, []);
  assert.notEqual(next, tasks);
  assert.equal(tasks.length, 1);
});

check("32. Некорректный, отсутствующий id и удаление из пустого списка", () => {
  const tasks = fixture();
  for (const id of [...invalidIds, 777]) expectFailure(removeTask(tasks, id));
  expectFailure(removeTask([], 1));
  assert.deepEqual(tasks, fixture());
});

check("33. Входные объекты не изменяются ни одной операцией", () => {
  // Замораживание здесь — инструмент проверки, а не часть прикладной модели.
  const tasks = Object.freeze(fixture().map((task) => Object.freeze(task)));
  assert.equal(findTaskById(tasks, 4), tasks[1]);
  assert.equal(getPendingTasks(tasks).length, 2);
  assert.equal(getTaskTitles(tasks).length, 4);
  assert.equal(getTaskStats(tasks).total, 4);
  expectTasks(addTask(tasks, 20, "Новая задача"));
  expectTasks(setTaskCompleted(tasks, 4, true));
  expectTasks(renameTask(tasks, 10, "Новое название"));
  expectTasks(removeTask(tasks, 7));
  expectFailure(addTask(tasks, 4, "Дубликат"));
  expectFailure(setTaskCompleted(tasks, 4, "true"));
  expectFailure(renameTask(tasks, 10, "   "));
  expectFailure(removeTask(tasks, 777));
  assert.deepEqual(tasks, fixture());
});

check("34. Общий сценарий и все промежуточные сводки", () => {
  const initial = fixture();
  let current = initial;
  const expectedStats = [
    { total: 4, completed: 2, pending: 2, progress: 50 },
    { total: 5, completed: 2, pending: 3, progress: 40 },
    { total: 5, completed: 3, pending: 2, progress: 60 },
    { total: 5, completed: 3, pending: 2, progress: 60 },
    { total: 4, completed: 3, pending: 1, progress: 75 },
  ];
  assert.deepEqual(getTaskStats(current), expectedStats[0]);
  current = expectTasks(addTask(current, 20, "Добавить проверку", "high"));
  assert.deepEqual(getTaskStats(current), expectedStats[1]);
  current = expectTasks(setTaskCompleted(current, 4, true));
  assert.deepEqual(getTaskStats(current), expectedStats[2]);
  current = expectTasks(renameTask(current, 10, "Подготовить инструкцию запуска"));
  assert.deepEqual(getTaskStats(current), expectedStats[3]);
  current = expectTasks(removeTask(current, 7));
  assert.deepEqual(getTaskStats(current), expectedStats[4]);
  assert.deepEqual(current.map((task) => task.id), [1, 4, 10, 20]);
  assert.equal(findTaskById(current, 10).title, "Подготовить инструкцию запуска");
  assert.deepEqual(initial, fixture());
});

check("35. Работа с другим набором, без зависимости от demoTasks", () => {
  const tasks = [
    { id: 203, title: "Альфа", completed: false, priority: "low" },
    { id: 88, title: "Бета", completed: false, priority: "high" },
  ];
  const before = copyTasks(tasks);
  assert.equal(findTaskById(tasks, 88), tasks[1]);
  assert.deepEqual(getTaskTitles(tasks), ["Альфа", "Бета"]);
  assert.deepEqual(getTaskStats(tasks), { total: 2, completed: 0, pending: 2, progress: 0 });
  const next = expectTasks(setTaskCompleted(tasks, 88, true));
  assert.deepEqual(getTaskStats(next), { total: 2, completed: 1, pending: 1, progress: 50 });
  assert.deepEqual(expectTasks(removeTask(next, 203)).map((task) => task.id), [88]);
  assert.deepEqual(tasks, before);
});

// Три собственных проверки можно добавить здесь, до итогового вывода,
// либо выполнить отдельно и описать в отчёте. Общие проверки удалять не нужно.
// Пример формы записи (не готовая проверка задания):
// check("Собственный случай: ...", () => {
//   const result = ...;
//   assert.deepEqual(result, ...);
// });

console.log(`\nПроверок пройдено: ${passed}; не пройдено: ${failed}.`);
if (failed > 0) {
  process.exitCode = 1;
}
