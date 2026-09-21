-- Выполнять только после 01_schema.sql в пустых таблицах.
INSERT INTO public.categories (id, name) VALUES
(1, 'Учёба'),
(2, 'Проект'),
(3, 'Организация');

INSERT INTO public.tasks (id, title, completed, priority, category_id) VALUES
(1, 'Изучить функции', true, 'medium', 1),
(4, 'Подготовить модель задач', false, 'high', 2),
(7, 'Проверить методы массивов', false, 'low', 1),
(10, 'Оформить README', true, 'medium', 3),
(13, 'Разобрать Promise', false, 'high', 1),
(16, 'Проверить учебный API', true, 'high', 2),
(19, 'Описать контракт запросов', false, 'medium', 3),
(22, 'Подготовить демонстрацию', false, 'low', 2),
(25, 'Исправить обработку ошибок', true, 'high', 2),
(28, 'Добавить фильтры API', false, 'medium', 2),
(31, 'Сверить отчёт', true, 'low', 3),
(34, 'Провести рефакторинг клиента', false, 'high', 2);

SELECT setval(
  pg_get_serial_sequence('public.categories', 'id'),
  (SELECT max(id) FROM public.categories),
  true
);
SELECT setval(
  pg_get_serial_sequence('public.tasks', 'id'),
  (SELECT max(id) FROM public.tasks),
  true
);
