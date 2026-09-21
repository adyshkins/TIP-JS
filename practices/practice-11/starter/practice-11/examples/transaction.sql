-- Учебное изменение исходной задачи с последующим откатом.
-- Запускать отдельно БЕЗ флага psql -1.
BEGIN;
SELECT id, completed FROM public.tasks WHERE id = 4;
UPDATE public.tasks SET completed = true WHERE id = 4 RETURNING id, completed;
ROLLBACK;
SELECT id, completed FROM public.tasks WHERE id = 4;
