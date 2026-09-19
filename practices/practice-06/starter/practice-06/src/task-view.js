const PRIORITY_LABELS = Object.freeze({
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
});

export function createTaskElement(task, category) {
  void task;
  void category;
  void PRIORITY_LABELS;
  // TODO: создать li.task-card с data-task-id, текстом и тремя кнопками:
  // data-action="toggle", data-action="edit", data-action="delete".
  // Пользовательские данные добавляются только через textContent.
  throw new Error("Не реализовано: createTaskElement");
}

export function renderTaskList(list, tasks, categories) {
  void list;
  void tasks;
  void categories;
  // TODO: сопоставить categoryId с категорией и заменить содержимое списка.
  throw new Error("Не реализовано: renderTaskList");
}
