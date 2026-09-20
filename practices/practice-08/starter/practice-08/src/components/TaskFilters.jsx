export default function TaskFilters({ filters, categories, onChange }) {
  const change = event => onChange({ ...filters, [event.target.name]: event.target.value });
  return <section><h2>Фильтры сервера</h2>
    <label htmlFor="q">Поиск</label><input id="q" name="q" maxLength={100} value={filters.q} onChange={change} />
    <label htmlFor="completed-filter">Статус</label>
    <select id="completed-filter" name="completed" value={filters.completed} onChange={change}>
      <option value="">Все</option><option value="false">В работе</option><option value="true">Выполненные</option>
    </select>
    <label htmlFor="priority-filter">Приоритет</label>
    <select id="priority-filter" name="priority" value={filters.priority} onChange={change}>
      <option value="">Все</option><option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option>
    </select>
    <label htmlFor="category-filter">Категория</label>
    <select id="category-filter" name="categoryId" value={filters.categoryId} onChange={change}>
      <option value="">Все</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
    <button type="button" onClick={() => onChange({ q: '', completed: '', priority: '', categoryId: '' })}>Сбросить фильтры</button>
  </section>;
}
