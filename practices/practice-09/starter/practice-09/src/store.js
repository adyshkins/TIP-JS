import { categories as seedCategories, tasks as seedTasks } from './data.js';
import { selectTasks, findTask } from './task-service.js';

// Для каждого приложения собственные копии данных, без открытия порта.
export function createStore() {
  const tasks = seedTasks.map(task => ({ ...task }));
  const categories = seedCategories.map(category => ({ ...category }));
  return {
    listTasks: filters => selectTasks(tasks, filters),
    getTask: id => findTask(tasks, id),
    listCategories: () => categories.map(category => ({ ...category })),
  };
}
