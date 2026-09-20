import { useState } from 'react';
import { api, apiBaseUrl } from './config.js';
import { createInitialFilters } from './variant.js';
import { useTaskData } from './hooks/useTaskData.js';
import TaskForm from './components/TaskForm.jsx';
import TaskFilters from './components/TaskFilters.jsx';
import TaskList from './components/TaskList.jsx';

export default function App() {
  const [filters, setFilters] = useState(createInitialFilters);
  // Снимок редактируемой записи сохраняется даже при её исчезновении из выборки.
  const [editingTask, setEditingTask] = useState(null);
  const [notice, setNotice] = useState('');
  const data = useTaskData({ api, filters });
  const { tasks, categories, meta } = data.snapshot;
  const disabled = data.pending || data.status !== 'ready';
  async function save(value) {
    setNotice('');
    const saved = await data.saveTask(editingTask?.id ?? null, value);
    if (saved) { setEditingTask(null); setNotice('Сохранено на сервере. Список обновляется.'); }
    return saved;
  }
  async function toggle(task) {
    setNotice('');
    if (await data.toggleTask(task)) {
      // Черновик названия не сбрасывается; PATCH формы не отправляет completed.
      setNotice('Статус сохранён. Список обновляется.');
    }
  }
  async function remove(task) {
    if (!window.confirm(`Удалить «${task.title}»?`)) return;
    setNotice('');
    if (await data.deleteTask(task.id)) {
      if (editingTask?.id === task.id) setEditingTask(null);
      setNotice('Задача удалена. Список обновляется.');
    }
  }
  async function reset() {
    if (!window.confirm('Восстановить учебный набор? Текущие изменения будут потеряны.')) return;
    setNotice('');
    if (await data.resetData()) { setEditingTask(null); setNotice('Учебный набор восстановлен.'); }
  }
  return <main>
    <h1>Задачи: React и API</h1><p>API: {apiBaseUrl}</p>
    <p>Изменения сохраняются до перезапуска учебного сервера.</p>
    <TaskFilters filters={filters} categories={categories} onChange={setFilters} />
    <button type="button" onClick={data.refresh}>Обновить список</button>
    <button type="button" disabled={disabled} onClick={reset}>Восстановить набор</button>
    <p role="status">{data.pending ? 'Сохранение…' : notice}</p>
    {data.mutationError && <p role="alert">Изменение не подтверждено: {data.mutationError.message}. При сетевой ошибке обновите список перед повтором.</p>}
    {categories.length > 0 && <TaskForm key={editingTask?.id ?? 'new'} categories={categories} initialTask={editingTask} onSave={save} onCancel={() => setEditingTask(null)} disabled={disabled} />}
    <section aria-busy={data.status === 'loading'}>
      <h2>Результат запроса</h2>
      {data.status === 'loading' && <p>Загрузка… Предыдущие данные могут быть устаревшими.</p>}
      {data.status === 'error' && <p role="alert">Не удалось обновить список: {data.error?.message}. Показан последний успешный результат. Нажмите «Обновить список».</p>}
      {data.status === 'ready' && tasks.length === 0 && <p>По выбранным условиям задач нет.</p>}
      <p>В последней полученной выборке: {meta.total}; выполнено: {tasks.filter(t => t.completed).length}.</p>
      <TaskList tasks={tasks} categories={categories} disabled={disabled} onEdit={setEditingTask} onToggle={toggle} onDelete={remove} />
    </section>
  </main>;
}
