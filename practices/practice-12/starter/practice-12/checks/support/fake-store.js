const categories = [
  { id: 1, name: 'Учёба' },
  { id: 2, name: 'Проект' },
  { id: 3, name: 'Организация' },
];
const seed = [
  { id: 1, title: 'Изучить функции', completed: true, priority: 'medium', categoryId: 1 },
  { id: 4, title: 'Подготовить модель задач', completed: false, priority: 'high', categoryId: 2 },
  { id: 7, title: 'Проверить методы массивов', completed: false, priority: 'low', categoryId: 1 },
];

const copy = value => structuredClone(value);

export function createFakeStore() {
  let tasks;
  let nextId;
  const store = {
    async ping() { return true; },
    async listCategories() { return copy(categories); },
    async listTasks(filters = { completed: null, priority: null, categoryId: null, q: '' }) {
      const q = filters.q.toLocaleLowerCase('ru-RU');
      return copy(tasks.filter(task => (
        (filters.completed === null || task.completed === filters.completed)
        && (filters.priority === null || task.priority === filters.priority)
        && (filters.categoryId === null || task.categoryId === filters.categoryId)
        && (!q || task.title.toLocaleLowerCase('ru-RU').includes(q))
      )));
    },
    async getTask(id) { return copy(tasks.find(task => task.id === id) ?? null); },
    async createTask(value) {
      const task = { id: nextId++, ...copy(value), completed: false };
      tasks.push(task);
      return copy(task);
    },
    async updateTask(id, changes) {
      const index = tasks.findIndex(task => task.id === id);
      if (index < 0) return null;
      tasks[index] = { ...tasks[index], ...copy(changes), id };
      return copy(tasks[index]);
    },
    async deleteTask(id) {
      const index = tasks.findIndex(task => task.id === id);
      if (index < 0) return false;
      tasks.splice(index, 1);
      return true;
    },
    async reset() {
      tasks = copy(seed);
      nextId = Math.max(...tasks.map(task => task.id)) + 1;
      return { reset: true, total: tasks.length };
    },
  };
  store.reset();
  return store;
}
