const priorities = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
export default function TaskList({ tasks, categories, disabled, onEdit, onToggle, onDelete }) {
  return <ul aria-label="Задачи">{tasks.map(task => <li key={task.id}>
    <strong>{task.title}</strong>
    <p>{task.completed ? 'Выполнена' : 'В работе'} · {priorities[task.priority]} · {categories.find(c => c.id === task.categoryId)?.name ?? 'Неизвестная категория'}</p>
    <button type="button" disabled={disabled} onClick={() => onToggle(task)}>Переключить статус</button>
    <button type="button" disabled={disabled} onClick={() => onEdit(task)}>Редактировать</button>
    <button type="button" disabled={disabled} onClick={() => onDelete(task)}>Удалить</button>
  </li>)}</ul>;
}
