const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

// Чистая проверка данных формы. DOM и показ сообщений выполняются в main.js.
// draft: { id, title, priority }; editingId: null либо id редактируемой задачи.
export function validateTaskDraft(draft, tasks, editingId = null) {
  // TODO: нормализовать и проверить id, title и priority.
  // В режиме создания id должен быть уникальным.
  // В режиме редактирования используется editingId и проверяется наличие задачи.
  // Успех: { ok: true, value: { id, title, priority } }.
  // Отказ: { ok: false, errors: { id?: "...", title?: "...", priority?: "..." } }.
  // ALLOWED_PRIORITIES можно использовать при проверке приоритета.
  void ALLOWED_PRIORITIES;
  void draft;
  void tasks;
  void editingId;
  throw new Error("Не реализовано: validateTaskDraft");
}
