// Вспомогательная реализация проверки формы из ПР7.
export function validateTaskDraft(draft, categories) {
  const value = {
    title: typeof draft.title === 'string' ? draft.title.trim() : '',
    priority: draft.priority, categoryId: Number(draft.categoryId),
  };
  const errors = {};
  if (!value.title || value.title.length > 100) errors.title = 'Название: от 1 до 100 символов.';
  if (!['low', 'medium', 'high'].includes(value.priority)) errors.priority = 'Выберите приоритет.';
  if (!Number.isSafeInteger(value.categoryId) || !categories.some(c => c.id === value.categoryId)) errors.categoryId = 'Выберите категорию.';
  return { valid: Object.keys(errors).length === 0, value, errors };
}
