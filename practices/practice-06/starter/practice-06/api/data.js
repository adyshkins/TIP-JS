export const categories = Object.freeze([
  Object.freeze({ id: 1, name: "Учёба" }),
  Object.freeze({ id: 2, name: "Проект" }),
  Object.freeze({ id: 3, name: "Организация" }),
]);

export const tasks = Object.freeze([
  Object.freeze({ id: 1, title: "Изучить функции", completed: true, priority: "medium", categoryId: 1 }),
  Object.freeze({ id: 4, title: "Подготовить модель задач", completed: false, priority: "high", categoryId: 2 }),
  Object.freeze({ id: 7, title: "Проверить методы массивов", completed: false, priority: "low", categoryId: 1 }),
  Object.freeze({ id: 10, title: "Оформить README", completed: true, priority: "medium", categoryId: 3 }),
  Object.freeze({ id: 13, title: "Разобрать Promise", completed: false, priority: "high", categoryId: 1 }),
  Object.freeze({ id: 16, title: "Проверить учебный API", completed: true, priority: "high", categoryId: 2 }),
  Object.freeze({ id: 19, title: "Описать контракт запросов", completed: false, priority: "medium", categoryId: 3 }),
  Object.freeze({ id: 22, title: "Подготовить демонстрацию", completed: false, priority: "low", categoryId: 2 }),
  Object.freeze({ id: 25, title: "Исправить обработку ошибок", completed: true, priority: "high", categoryId: 2 }),
  Object.freeze({ id: 28, title: "Добавить фильтры API", completed: false, priority: "medium", categoryId: 2 }),
  Object.freeze({ id: 31, title: "Сверить отчёт", completed: true, priority: "low", categoryId: 3 }),
  Object.freeze({ id: 34, title: "Провести рефакторинг клиента", completed: false, priority: "high", categoryId: 2 }),
]);
