import { useState } from 'react';
import { tasks as initialTasks, categories } from './data.js';
import { createInitialFilters } from './variant.js';
import TaskForm from './components/TaskForm.jsx';
import TaskFilters from './components/TaskFilters.jsx';
import TaskList from './components/TaskList.jsx';
import TaskStats from './components/TaskStats.jsx';

export default function App() {
  const [tasks, setTasks] = useState(() => initialTasks.map(task => ({ ...task })));
  const [filters, setFilters] = useState(createInitialFilters);
  const [editingId, setEditingId] = useState(null);
  // TODO: вычислить visibleTasks, stats и editingTask; реализовать обработчики.
  // TODO: передать данные и обратные вызовы компонентам согласно методичке.
  return (
    <main>
      <h1>Задачи на React</h1>
      <p>ПР7: данные в памяти. Обновление страницы восстанавливает исходный набор.</p>
      <p role="status">Заготовка запущена. В наборе {tasks.length} задач, категорий: {categories.length}.</p>
      <TaskStats />
      <TaskFilters filters={filters} categories={categories} onChange={setFilters} />
      <TaskForm categories={categories} />
      <TaskList tasks={[]} categories={categories} />
    </main>
  );
}
