export function selectTasks(tasks, filters) {
  const needle = filters.q.toLocaleLowerCase("ru-RU");
  return tasks.filter((task) => {
    if (filters.completed !== null && task.completed !== filters.completed) return false;
    if (filters.priority !== null && task.priority !== filters.priority) return false;
    if (filters.categoryId !== null && task.categoryId !== filters.categoryId) return false;
    return !needle || task.title.toLocaleLowerCase("ru-RU").includes(needle);
  });
}


export function findTask(tasks, id) { return tasks.find(task => task.id === id) ?? null; }
