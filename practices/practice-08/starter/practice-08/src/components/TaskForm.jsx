import { useRef, useState } from 'react';
import { validateTaskDraft } from '../form-validation.js';

// Готовая адаптация контракта формы ПР7: onSave теперь возвращает Promise<boolean>.
export default function TaskForm({ categories, initialTask = null, onSave, onCancel, disabled }) {
  const emptyDraft = () => ({ title: '', priority: 'medium', categoryId: String(categories[0]?.id ?? '') });
  const [draft, setDraft] = useState(() => initialTask ? {
    title: initialTask.title, priority: initialTask.priority, categoryId: String(initialTask.categoryId),
  } : emptyDraft());
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);
  const change = event => setDraft(previous => ({ ...previous, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    if (disabled || submitting.current) return;
    const result = validateTaskDraft(draft, categories);
    setErrors(result.errors);
    if (!result.valid) return;
    submitting.current = true;
    try {
      const saved = await onSave(result.value);
      if (saved && !initialTask) setDraft(emptyDraft());
    } catch (error) {
      setErrors({ submit: error.message || 'Ошибка сохранения.' });
    } finally { submitting.current = false; }
  }
  return <section><h2>{initialTask ? 'Редактирование' : 'Новая задача'}</h2>
    <form onSubmit={submit} noValidate>
      <fieldset disabled={disabled}>
        <legend>Поля задачи</legend>
        <label htmlFor="title">Название</label>
        <input id="title" name="title" value={draft.title} onChange={change} aria-invalid={Boolean(errors.title)} aria-describedby="title-error" />
        <p id="title-error" className="error">{errors.title}</p>
        <label htmlFor="priority">Приоритет</label>
        <select id="priority" name="priority" value={draft.priority} onChange={change} aria-invalid={Boolean(errors.priority)} aria-describedby="priority-error">
          <option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option>
        </select><p id="priority-error" className="error">{errors.priority}</p>
        <label htmlFor="categoryId">Категория</label>
        <select id="categoryId" name="categoryId" value={draft.categoryId} onChange={change} aria-invalid={Boolean(errors.categoryId)} aria-describedby="category-error">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select><p id="category-error" className="error">{errors.categoryId}</p>
        <button type="submit">Сохранить</button>
        {initialTask && <button type="button" onClick={onCancel}>Отмена</button>}
      </fieldset>
      {errors.submit && <p role="alert">{errors.submit}</p>}
    </form>
  </section>;
}
