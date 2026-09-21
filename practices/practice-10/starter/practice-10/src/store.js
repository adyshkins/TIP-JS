import { categories as seedCategories, tasks as seedTasks } from './data.js';
import { selectTasks, findTask } from './task-service.js';
import { notImplemented } from './errors.js';
const noFilters = { completed: null, priority: null, categoryId: null, q: '' };

export function createStore() {
  let tasks;
  let nextId;
  const categories = seedCategories.map(item => ({ ...item }));
  function reset() {
    tasks = seedTasks.map(item => ({ ...item }));
    nextId = Math.max(0, ...tasks.map(item => item.id)) + 1;
    return { reset: true, total: tasks.length };
  }
  reset();
  return {
    listTasks: (filters = noFilters) => selectTasks(tasks, filters).map(item => ({ ...item })),
    getTask: id => { const task = findTask(tasks, id); return task ? { ...task } : null; },
    listCategories: () => categories.map(item => ({ ...item })),
    reset,
    createTask(value) {
      // TODO: value уже проверен. Назначить nextId и completed:false,
      // скопировать title/priority/categoryId, добавить запись, увеличить nextId.
      // Вернуть копию созданной записи. Не использовать tasks.length как id.
      return notImplemented('store.createTask');
    },
    updateTask(id, changes) {
      // TODO: найти запись, при отсутствии вернуть null; применить только
      // переданные изменения, сохранить id, заменить запись и вернуть копию.
      return notImplemented('store.updateTask');
    },
    deleteTask(id) {
      // TODO: при отсутствии вернуть false; иначе удалить только найденную
      // запись и вернуть true. Счётчик nextId после удаления не уменьшать.
      return notImplemented('store.deleteTask');
    },
  };
}
