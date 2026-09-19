// Перед началом ПР4 перенести проверенную реализацию функций ПР2–ПР3.
// Затем добавить updateTask по контракту ПР4.
// Для предусмотренных ошибок возвращается { ok: false, error: "..." }.
// DOM, localStorage и внешнее состояние в этом модуле не используются.

export function createTask(id, title, priority = "medium") {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: createTask");
}

export function findTaskById(tasks, id) {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: findTaskById");
}

export function getPendingTasks(tasks) {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: getPendingTasks");
}

export function getTaskTitles(tasks) {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: getTaskTitles");
}

export function getTaskStats(tasks) {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: getTaskStats");
}

export function addTask(tasks, id, title, priority = "medium") {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: addTask");
}

export function setTaskCompleted(tasks, id, completed) {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: setTaskCompleted");
}

export function renameTask(tasks, id, title) {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: renameTask");
}

export function removeTask(tasks, id) {
  // TODO: перенести проверенную реализацию из предыдущей работы.
  throw new Error("Не реализовано: removeTask");
}

export function updateTask(tasks, id, title, priority) {
  // TODO ПР4: проверить id, существование задачи, title и priority.
  // Вернуть новый массив, изменив только title и priority выбранной задачи.
  // Поле completed и исходный массив должны сохраниться.
  throw new Error("Не реализовано: updateTask");
}
