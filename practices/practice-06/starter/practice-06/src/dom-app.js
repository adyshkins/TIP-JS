import { renderTaskList } from "./task-view.js";

function required(root, selector) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`В разметке отсутствует ${selector}`);
  return node;
}

function option(value, label) {
  const node = document.createElement("option");
  node.value = String(value);
  node.textContent = label;
  return node;
}

export function createDomView(root = document) {
  const nodes = {
    apiUrl: required(root, "#api-url"),
    listPanel: required(root, "#list-panel"),
    listState: required(root, "#list-state"),
    stateMessage: required(root, "[data-state-message]"),
    retry: required(root, "#retry-load"),
    list: required(root, "#task-list"),
    total: required(root, "#task-total"),
    operation: required(root, "#operation-message"),
    taskForm: required(root, "#task-form"),
    title: required(root, "#task-title"),
    priority: required(root, "#task-priority"),
    category: required(root, "#task-category"),
    formHeading: required(root, "#editor-heading"),
    formMode: required(root, "#form-mode"),
    formSubmit: required(root, "#form-submit"),
    cancelEdit: required(root, "#cancel-edit"),
    filtersForm: required(root, "#filters-form"),
    filterQuery: required(root, "#filter-query"),
    filterCompleted: required(root, "#filter-completed"),
    filterPriority: required(root, "#filter-priority"),
    filterCategory: required(root, "#filter-category"),
    clearFilters: required(root, "#clear-filters"),
    refresh: required(root, "#refresh-list"),
    resetData: required(root, "#reset-data"),
  };
  let configuredFilters = {};

  function readFilters() {
    const filters = {};
    const q = nodes.filterQuery.value.trim();
    if (q) filters.q = q;
    if (nodes.filterCompleted.value) filters.completed = nodes.filterCompleted.value === "true";
    if (nodes.filterPriority.value) filters.priority = nodes.filterPriority.value;
    if (nodes.filterCategory.value) filters.categoryId = Number(nodes.filterCategory.value);
    return filters;
  }

  function readDraft() {
    return {
      title: nodes.title.value,
      priority: nodes.priority.value,
      categoryId: nodes.category.value,
    };
  }

  return {
    connect(handlers) {
      nodes.taskForm.addEventListener("submit", (event) => {
        event.preventDefault();
        handlers.submit(readDraft());
      });
      nodes.filtersForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const filters = readFilters();
        configuredFilters = { ...filters };
        handlers.filters(filters);
      });
      nodes.clearFilters.addEventListener("click", () => {
        nodes.filtersForm.reset();
        configuredFilters = {};
        handlers.filters({});
      });
      nodes.refresh.addEventListener("click", handlers.refresh);
      nodes.retry.addEventListener("click", handlers.refresh);
      nodes.cancelEdit.addEventListener("click", handlers.cancelEdit);
      nodes.resetData.addEventListener("click", () => {
        if (window.confirm("Восстановить исходные данные на учебном сервере?")) handlers.resetData();
      });
      nodes.list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        const item = button?.closest("[data-task-id]");
        if (!button || !item || !nodes.list.contains(button)) return;
        const id = Number(item.dataset.taskId);
        if (button.dataset.action === "delete") {
          if (window.confirm("Удалить задачу?")) handlers.taskAction("delete", id);
          return;
        }
        handlers.taskAction(button.dataset.action, id);
      });
    },

    setApiUrl(value) {
      nodes.apiUrl.textContent = value;
    },

    setFilters(filters = {}) {
      configuredFilters = { ...filters };
      nodes.filterQuery.value = filters.q ?? "";
      nodes.filterCompleted.value = filters.completed === true
        ? "true"
        : filters.completed === false ? "false" : "";
      nodes.filterPriority.value = filters.priority ?? "";
      nodes.filterCategory.value = filters.categoryId == null ? "" : String(filters.categoryId);
    },

    setCategories(categories) {
      nodes.category.replaceChildren(option("", "Выберите категорию"));
      nodes.filterCategory.replaceChildren(option("", "Все"));
      for (const category of categories) {
        nodes.category.append(option(category.id, category.name));
        nodes.filterCategory.append(option(category.id, category.name));
      }
      nodes.filterCategory.value = configuredFilters.categoryId == null
        ? ""
        : String(configuredFilters.categoryId);
    },

    setTasks(tasks, categories) {
      renderTaskList(nodes.list, tasks, categories);
    },

    setTotal(value) {
      nodes.total.textContent = String(value);
    },

    setListState(kind, message = "") {
      const defaults = {
        loading: "Загрузка задач…",
        ready: "",
        empty: "По выбранным условиям задач нет.",
        error: "Не удалось загрузить задачи.",
      };
      nodes.listPanel.setAttribute("aria-busy", String(kind === "loading"));
      nodes.listState.dataset.kind = kind;
      nodes.stateMessage.textContent = message || defaults[kind] || "";
      nodes.retry.hidden = kind !== "error";
      nodes.list.hidden = kind !== "ready";
    },

    setFormTask(task) {
      const editing = Boolean(task);
      nodes.formHeading.textContent = editing ? "Редактирование задачи" : "Добавление задачи";
      nodes.formMode.textContent = editing
        ? `Изменяется задача № ${task.id}.`
        : "Идентификатор назначит сервер.";
      nodes.title.value = task?.title ?? "";
      nodes.priority.value = task?.priority ?? "medium";
      nodes.category.value = task ? String(task.categoryId) : "";
      nodes.formSubmit.textContent = editing ? "Сохранить изменения" : "Добавить задачу";
      nodes.cancelEdit.hidden = !editing;
    },

    showFormErrors(errors = {}) {
      for (const name of ["title", "priority", "categoryId"]) {
        const control = name === "categoryId" ? nodes.category : nodes[name];
        const output = required(root, `[data-error-for="${name}"]`);
        const message = errors[name] ?? "";
        output.textContent = message;
        if (message) control.setAttribute("aria-invalid", "true");
        else control.removeAttribute("aria-invalid");
      }
    },

    setMutationPending(pending) {
      for (const node of [nodes.formSubmit, nodes.cancelEdit, nodes.resetData, ...nodes.list.querySelectorAll("button[data-action]")]) {
        node.disabled = pending;
      }
    },

    notify(message = "", tone = "") {
      nodes.operation.textContent = message;
      nodes.operation.className = `operation-message${tone ? ` is-${tone}` : ""}`;
    },
  };
}
