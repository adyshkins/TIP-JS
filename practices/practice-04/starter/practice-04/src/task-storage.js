export const STORAGE_VERSION = 1;

// Все функции принимают объект storage явно, чтобы их можно было проверить
// без обращения к глобальному window.localStorage.

export function isValidTaskList(value) {
  // TODO: проверить массив задач, поля каждой задачи и уникальность id.
  throw new Error("Не реализовано: isValidTaskList");
}

export function loadTasks(storage, key, fallbackTasks) {
  // TODO: прочитать строку, разобрать объект { version, tasks }, проверить данные.
  // Нет записи: { ok: true, source: "initial", tasks: копия fallbackTasks }.
  // Есть корректная запись: { ok: true, source: "storage", tasks: новая копия }.
  // Ошибка чтения, JSON или схемы: { ok: false, source: "fallback",
  // tasks: копия fallbackTasks, error: "понятное сообщение" }.
  throw new Error("Не реализовано: loadTasks");
}

export function saveTasks(storage, key, tasks) {
  // TODO: проверить задачи и сохранить JSON.stringify({ version, tasks }).
  // Вернуть { ok: true } либо { ok: false, error: "..." }; исключение не выпускать.
  throw new Error("Не реализовано: saveTasks");
}

export function removeSavedTasks(storage, key) {
  // TODO: удалить только переданный ключ; вернуть результат и перехватить исключение.
  throw new Error("Не реализовано: removeSavedTasks");
}
