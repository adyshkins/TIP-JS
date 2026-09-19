import { ApiError, createApiClient } from "./api-client.js";
import { createTaskApi } from "./task-api.js";
import { variantFilters, variantNumber } from "./variant.js";

const baseUrl = process.env.API_URL ?? "http://127.0.0.1:5505/api";

function describeError(error) {
  if (!(error instanceof ApiError)) {
    return `Неожиданная ошибка: ${error.message}`;
  }

  const parts = [`Тип: ${error.kind}`, error.message];
  if (error.status !== null) parts.push(`HTTP ${error.status}`);
  if (error.code !== null) parts.push(`Код API: ${error.code}`);
  return parts.join(" · ");
}

try {
  const client = createApiClient({ baseUrl, timeoutMs: 2000 });
  const api = createTaskApi(client);
  const filters = variantNumber === null
    ? { completed: false, priority: "high" }
    : variantFilters;

  const startedAt = performance.now();
  const { tasks, categories, meta } = await api.loadInitialData(filters);
  const elapsedMs = performance.now() - startedAt;
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  console.log(
    variantNumber === null
      ? "Общий контрольный запрос"
      : `Индивидуальный вариант ${variantNumber}`,
  );
  console.log("Фильтры:", meta.filters);
  console.log(`Получено задач: ${meta.total}; время: ${elapsedMs.toFixed(1)} мс`);
  console.table(tasks.map((task) => ({
    id: task.id,
    title: task.title,
    completed: task.completed,
    priority: task.priority,
    category: categoryNames.get(task.categoryId) ?? "Неизвестно",
  })));

  try {
    await api.getTaskById(999);
  } catch (error) {
    console.log("Контрольная ошибка 404:", describeError(error));
  }
} catch (error) {
  console.error(describeError(error));
  console.error(`Проверяемый адрес API: ${baseUrl}`);
  process.exitCode = 1;
}
