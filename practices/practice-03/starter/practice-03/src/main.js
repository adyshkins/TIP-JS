import { demoTasks, variantTasks, variantNumber } from "./data.js";
import { findTaskById, setTaskCompleted, removeTask } from "./task-service.js";
import { getVisibleTasks } from "./task-selectors.js";
import { renderTaskList, renderSummary, renderEmptyState } from "./task-view.js";

const elements = {
  list: document.querySelector("#task-list"),
  filters: document.querySelector("#task-filters"),
  summary: document.querySelector("#task-summary"),
  empty: document.querySelector("#empty-message"),
  message: document.querySelector("#operation-message"),
  datasetLabel: document.querySelector("#dataset-label"),
};

// Готовая служебная часть: ?dataset=variant включает данные своего варианта.
// Наборы не смешиваются, редактировать код для переключения не требуется.
const isVariant = new URLSearchParams(window.location.search).get("dataset") === "variant";
const initialTasks = isVariant ? variantTasks : demoTasks;
let currentTasks = initialTasks.map((task) => ({ ...task }));
let currentFilter = "all";

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

function renderApp() {
  // TODO: отобрать видимые задачи; обновить список, общую сводку и пустое состояние.
  // TODO: для кнопок фильтра обновить is-active и aria-pressed.
  // Не изменять currentTasks и не добавлять обработчики событий в этой функции.
  throw new Error("Не реализовано: renderApp");
}

function handleTaskListClick(event) {
  // TODO: найти кнопку через closest(), проверить её принадлежность списку.
  // TODO: распознать toggle/delete; прочитать и проверить числовой id карточки.
  // TODO: вызвать функцию ПР2, разобрать ok/error, сохранить успешный результат.
  // TODO: renderApp(), затем restoreTaskFocus(id, action).
  throw new Error("Не реализовано: handleTaskListClick");
}

function handleFilterClick(event) {
  // TODO: найти кнопку фильтра, проверить all/pending/completed.
  // TODO: изменить только currentFilter, очистить сообщение и вызвать renderApp().
  throw new Error("Не реализовано: handleFilterClick");
}

// Готовая вспомогательная функция. Сохраняет понятную позицию клавиатурного фокуса
// после замены карточек. Если карточки больше нет, фокус получает активный фильтр.
function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

// Подписки выполняются один раз. Эти контейнеры не заменяются при перерисовке.
elements.list.addEventListener("click", handleTaskListClick);
elements.filters.addEventListener("click", handleFilterClick);

// До реализации renderApp ожидается сообщение о заглушке.
// try/catch здесь — готовая диагностика старта, а не замена проверки result.ok.
try {
  renderApp();
} catch (error) {
  elements.message.textContent = `Ошибка запуска: ${error.message}`;
  console.error(error);
}
