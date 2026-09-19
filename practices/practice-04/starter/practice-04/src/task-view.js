import { getTaskStats } from "./task-service.js";

// Перенести реализацию ПР3 и расширить карточку действием edit.
// Здесь создаётся DOM, но не изменяются данные и localStorage.
export function createTaskElement(task) {
  // TODO: li.task-card[data-task-id], название, статус и приоритет.
  // TODO: три кнопки: toggle, edit и delete; у каждой span.action-label.
  // Название выводится через textContent. Обработчики здесь не назначаются.
  throw new Error("Не реализовано: createTaskElement");
}

export function renderTaskList(listElement, tasks) {
  // TODO: перенести реализацию ПР3; повторный вызов не накапливает карточки.
  throw new Error("Не реализовано: renderTaskList");
}

export function renderSummary(summaryElement, tasks, visibleCount) {
  // TODO: перенести реализацию ПР3.
  throw new Error("Не реализовано: renderSummary");
}

export function renderEmptyState(messageElement, total, visibleCount) {
  // TODO: перенести реализацию ПР3.
  throw new Error("Не реализовано: renderEmptyState");
}
