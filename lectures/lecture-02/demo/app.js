const STORAGE_KEY = "tip-js:lecture-02:topics";
const STORAGE_VERSION = 1;
const FILTERS = new Set(["all", "active", "completed"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const PRIORITY_LABELS = {
  low: "Низкий приоритет",
  medium: "Средний приоритет",
  high: "Высокий приоритет",
};

const initialTopics = [
  { id: 1, title: "Разобрать DOM-дерево", completed: true, priority: "medium" },
  { id: 2, title: "Проверить всплытие событий", completed: false, priority: "high" },
  { id: 3, title: "Повторить JSON и localStorage", completed: false, priority: "low" },
];

const elements = {
  form: requireElement("#topic-form"),
  titleInput: requireElement("#topic-title"),
  prioritySelect: requireElement("#topic-priority"),
  status: requireElement("#app-status"),
  filters: requireElement("#filters"),
  list: requireElement("#topic-list"),
  emptyMessage: requireElement("#empty-message"),
  visibleCount: requireElement("#visible-count"),
  totalCount: requireElement("#total-count"),
  resetButton: requireElement("#reset-button"),
};

const restored = readTopics();
const state = {
  topics: restored.topics,
  filter: "all",
};

elements.form.addEventListener("submit", handleSubmit);
elements.titleInput.addEventListener("input", clearTitleError);
elements.prioritySelect.addEventListener("change", clearPriorityError);
elements.filters.addEventListener("click", handleFilterClick);
elements.list.addEventListener("click", handleListClick);
elements.resetButton.addEventListener("click", handleReset);

render();

if (restored.warning) {
  announce(restored.warning, true);
}

function requireElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Не найден обязательный элемент: ${selector}`);
  }

  return element;
}

function cloneInitialTopics() {
  return initialTopics.map((topic) => ({ ...topic }));
}

function normalizeTitle(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function validateDraft(draft) {
  const title = normalizeTitle(draft.title);

  if (title.length < 2 || title.length > 80) {
    return {
      ok: false,
      field: "title",
      error: "Введите название длиной от 2 до 80 символов",
    };
  }

  if (!PRIORITIES.has(draft.priority)) {
    return {
      ok: false,
      field: "priority",
      error: "Выбран неизвестный приоритет",
    };
  }

  return {
    ok: true,
    value: {
      title,
      priority: draft.priority,
    },
  };
}

function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.form);
  const result = validateDraft({
    title: formData.get("title"),
    priority: formData.get("priority"),
  });

  if (!result.ok) {
    announce(result.error, true);

    if (result.field === "title") {
      elements.titleInput.setCustomValidity(result.error);
      elements.titleInput.reportValidity();
    } else {
      elements.prioritySelect.setCustomValidity(result.error);
      elements.prioritySelect.reportValidity();
    }

    return;
  }

  const topic = {
    id: getNextId(state.topics),
    title: result.value.title,
    completed: false,
    priority: result.value.priority,
  };

  commitTopics([...state.topics, topic], `Добавлена тема «${topic.title}»`);
  elements.form.reset();
  elements.titleInput.setCustomValidity("");
  elements.prioritySelect.setCustomValidity("");
  elements.titleInput.focus();
}

function clearTitleError() {
  elements.titleInput.setCustomValidity("");
}

function clearPriorityError() {
  elements.prioritySelect.setCustomValidity("");
}

function getNextId(topics) {
  const maximumId = topics.reduce((maximum, topic) => Math.max(maximum, topic.id), 0);
  return maximumId + 1;
}

function handleFilterClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-filter]");

  if (!button || !elements.filters.contains(button)) {
    return;
  }

  const { filter } = button.dataset;

  if (!FILTERS.has(filter) || filter === state.filter) {
    return;
  }

  state.filter = filter;
  render();
  announce(`Выбран фильтр «${button.textContent.trim()}»`);
}

function handleListClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action]");

  if (!button || !elements.list.contains(button)) {
    return;
  }

  const item = button.closest("[data-topic-id]");
  const topicId = Number(item?.dataset.topicId);

  if (!Number.isSafeInteger(topicId) || topicId <= 0) {
    announce("Не удалось определить выбранную тему", true);
    return;
  }

  const topic = state.topics.find((candidate) => candidate.id === topicId);

  if (!topic) {
    announce("Выбранная тема больше не существует", true);
    return;
  }

  if (button.dataset.action === "toggle") {
    const nextTopics = state.topics.map((candidate) =>
      candidate.id === topicId
        ? { ...candidate, completed: !candidate.completed }
        : candidate,
    );

    const nextStatus = topic.completed ? "возвращена в работу" : "отмечена изученной";
    commitTopics(nextTopics, `Тема «${topic.title}» ${nextStatus}`);
    return;
  }

  if (button.dataset.action === "delete") {
    const nextTopics = state.topics.filter((candidate) => candidate.id !== topicId);
    commitTopics(nextTopics, `Тема «${topic.title}» удалена`);
  }
}

function handleReset() {
  state.topics = cloneInitialTopics();
  state.filter = "all";

  const result = removeSavedTopics();
  render();
  announce(
    result.ok
      ? "Демонстрационные данные восстановлены"
      : `Данные восстановлены в памяти. ${result.error}`,
    !result.ok,
  );
  elements.titleInput.focus();
}

function commitTopics(nextTopics, successMessage) {
  state.topics = nextTopics;
  const result = writeTopics(nextTopics);
  render();

  announce(
    result.ok
      ? successMessage
      : `${successMessage}. ${result.error}`,
    !result.ok,
  );
}

function selectVisibleTopics(topics, filter) {
  if (filter === "active") {
    return topics.filter((topic) => !topic.completed);
  }

  if (filter === "completed") {
    return topics.filter((topic) => topic.completed);
  }

  return topics;
}

function render() {
  const visibleTopics = selectVisibleTopics(state.topics, state.filter);
  const fragment = document.createDocumentFragment();

  for (const topic of visibleTopics) {
    fragment.append(createTopicElement(topic));
  }

  elements.list.replaceChildren(fragment);
  elements.emptyMessage.hidden = visibleTopics.length > 0;
  elements.visibleCount.textContent = String(visibleTopics.length);
  elements.totalCount.textContent = String(state.topics.length);

  for (const button of elements.filters.querySelectorAll("button[data-filter]")) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter));
  }
}

function createTopicElement(topic) {
  const item = document.createElement("li");
  item.classList.add("topic-card");
  item.classList.toggle("topic-card--completed", topic.completed);
  item.dataset.topicId = String(topic.id);

  const marker = document.createElement("span");
  marker.classList.add("topic-card__marker");
  marker.textContent = topic.completed ? "✓" : "•";
  marker.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.classList.add("topic-card__content");

  const title = document.createElement("span");
  title.classList.add("topic-card__title");
  title.textContent = topic.title;

  const meta = document.createElement("span");
  meta.classList.add("topic-card__meta");
  meta.textContent = `${PRIORITY_LABELS[topic.priority]} · ${
    topic.completed ? "изучена" : "в работе"
  }`;

  content.append(title, meta);

  const actions = document.createElement("div");
  actions.classList.add("topic-card__actions");

  const toggleButton = createActionButton(
    "toggle",
    topic.completed ? "Вернуть в работу" : "Отметить изученной",
  );
  const deleteButton = createActionButton("delete", "Удалить", true);

  actions.append(toggleButton, deleteButton);
  item.append(marker, content, actions);

  return item;
}

function createActionButton(action, label, isDanger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("topic-card__action");
  button.classList.toggle("topic-card__action--danger", isDanger);
  button.dataset.action = action;

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  button.append(labelElement);

  return button;
}

function announce(message, isWarning = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("status--warning", isWarning);
}

function readTopics() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw === null) {
      return { topics: cloneInitialTopics(), warning: "" };
    }

    const parsed = JSON.parse(raw);
    return { topics: validateStoredPayload(parsed), warning: "" };
  } catch (error) {
    return {
      topics: cloneInitialTopics(),
      warning: `Сохранённые данные не использованы: ${getErrorMessage(error)}`,
    };
  }
}

function validateStoredPayload(payload) {
  if (
    payload === null ||
    typeof payload !== "object" ||
    payload.version !== STORAGE_VERSION ||
    !Array.isArray(payload.topics)
  ) {
    throw new Error("неподдерживаемая структура хранилища");
  }

  const ids = new Set();

  for (const topic of payload.topics) {
    const validTopic =
      topic !== null &&
      typeof topic === "object" &&
      Number.isSafeInteger(topic.id) &&
      topic.id > 0 &&
      typeof topic.title === "string" &&
      normalizeTitle(topic.title).length >= 2 &&
      normalizeTitle(topic.title).length <= 80 &&
      typeof topic.completed === "boolean" &&
      PRIORITIES.has(topic.priority);

    if (!validTopic || ids.has(topic.id)) {
      throw new Error("обнаружена некорректная или повторяющаяся запись");
    }

    ids.add(topic.id);
  }

  return payload.topics.map((topic) => ({
    id: topic.id,
    title: normalizeTitle(topic.title),
    completed: topic.completed,
    priority: topic.priority,
  }));
}

function writeTopics(topics) {
  try {
    const payload = {
      version: STORAGE_VERSION,
      topics,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Не удалось записать localStorage: ${getErrorMessage(error)}`,
    };
  }
}

function removeSavedTopics() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Не удалось удалить ключ localStorage: ${getErrorMessage(error)}`,
    };
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "неизвестная ошибка";
}
