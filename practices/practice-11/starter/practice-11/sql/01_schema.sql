-- Запуск в новой пустой БД tip_tasks от владельца tip_app.
-- TODO: заменить исключение определениями public.categories и public.tasks.
-- Сначала categories, затем tasks. Требования к колонкам — в методичке.
-- Не добавлять DROP, IF NOT EXISTS или COMMIT: транзакцией управляет psql -1.
DO $$ BEGIN RAISE EXCEPTION 'TODO: реализовать 01_schema.sql'; END $$;
