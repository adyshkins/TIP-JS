import { getTaskStats } from "./task-service.js";

// Здесь создаётся DOM, но не изменяется состояние приложения.
// Контракт карточки, селекторы и тексты описаны в методичке.
export function createTaskElement(task) {
  // TODO: li.task-card[data-task-id], название, статус, приоритет, две кнопки.
  // Название — через textContent. Обработчики здесь не назначаются.
  throw new Error("Не реализовано: createTaskElement");
}

export function renderTaskList(listElement, tasks) {
  // TODO: создать карточки и заменить дочерние элементы списка.
  // Сам listElement сохраняется: на нём находится делегированный обработчик.
  throw new Error("Не реализовано: renderTaskList");
}

export function renderSummary(summaryElement, tasks, visibleCount) {
  // TODO: получить getTaskStats(tasks), обновить пять [data-stat] внутри блока.
  // tasks — ВЕСЬ текущий массив, visibleCount — длина отфильтрованного списка.
  throw new Error("Не реализовано: renderSummary");
}

export function renderEmptyState(messageElement, total, visibleCount) {
  // TODO: различать пустой общий список и пустой результат фильтра.
  throw new Error("Не реализовано: renderEmptyState");
}
