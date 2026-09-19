import { ApiError } from "./api-client.js";
import { validateTaskDraft } from "./form-validation.js";

export function messageForError(error) {
  if (!(error instanceof ApiError)) return "Не удалось выполнить операцию.";
  if (error.kind === "timeout") return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  if (error.kind === "network") return "Нет соединения с учебным API. Проверьте, запущен ли npm start.";
  if (error.kind === "invalid-response") return "Сервер вернул ответ неожиданного формата.";
  if (error.kind === "http" && error.status === 404) return "Запись уже отсутствует на сервере. Обновите список.";
  if (error.kind === "http") return error.message || `Сервер вернул ошибку ${error.status}.`;
  return "Не удалось выполнить операцию.";
}

// view — адаптер из dom-app.js. Контроллер не должен обращаться к document.
// Обязательные методы результата:
// start, applyFilters, refresh, submit, beginEdit, cancelEdit,
// toggleTask, deleteTask, resetData и destroy.
export function createAppController({ api, view, validateDraft = validateTaskDraft } = {}) {
  void api;
  void view;
  void validateDraft;
  void ApiError;

  // TODO:
  // 1. Хранить текущие tasks, categories, filters и editingId.
  // 2. При загрузке показывать loading, затем ready/empty или error.
  // 3. Перед новой загрузкой отменять предыдущую через AbortController.
  // 4. Не позволять устаревшему ответу изменить интерфейс.
  // 5. После успешной мутации повторно запросить список с текущими фильтрами.
  // 6. Ошибку отменённого запроса не показывать пользователю.
  // 7. Если категории ещё не были получены, retry снова выполняет начальную загрузку.
  throw new Error("Не реализовано: createAppController");
}
