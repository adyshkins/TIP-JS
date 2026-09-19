const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

// Возвращает { valid, value, errors }.
// value содержит нормализованные title, priority и числовой categoryId.
export function validateTaskDraft(draft, categories) {
  void draft;
  void categories;
  void ALLOWED_PRIORITIES;
  // TODO: проверить название, приоритет и существование категории.
  // Ошибки записываются по ключам title, priority и categoryId.
  throw new Error("Не реализовано: validateTaskDraft");
}
