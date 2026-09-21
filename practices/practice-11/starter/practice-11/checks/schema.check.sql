-- Запуск: psql ... -v ON_ERROR_STOP=1 -f checks/schema.check.sql
-- Транзакция откатывает строки и вспомогательные функции, но НЕ значения sequence.
BEGIN;
CREATE TEMP TABLE pr11_results (n integer GENERATED ALWAYS AS IDENTITY, label text);
CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
 INSERT INTO pr11_results(label) VALUES (label);
END $$;
CREATE FUNCTION pg_temp.expect_error(command text, expected_state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
 BEGIN
  EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
 END;
 IF actual_state IS NULL OR NOT (actual_state = ANY(string_to_array(expected_state, ','))) THEN
  RAISE EXCEPTION 'FAIL: %, expected %, received %', label, expected_state, coalesce(actual_state, 'success');
 END IF;
 INSERT INTO pr11_results(label) VALUES (label);
END $$;
SELECT pg_temp.assert_true((SELECT count(*) = 3 FROM public.categories), '3 категории');
SELECT pg_temp.assert_true((SELECT count(*) = 12 FROM public.tasks), '12 задач');
SELECT pg_temp.assert_true((SELECT array_agg(id ORDER BY id) = ARRAY[1,4,7,10,13,16,19,22,25,28,31,34] FROM public.tasks), 'Исходные id задач');
SELECT pg_temp.assert_true((SELECT array_agg(name ORDER BY id) = ARRAY['Учёба','Проект','Организация'] FROM public.categories), 'Категории ПР10');
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('tasks','categories') AND column_name='id' AND is_identity='YES' AND identity_generation='BY DEFAULT' AND data_type='integer'), 'Два integer identity BY DEFAULT');
SELECT pg_temp.assert_true((SELECT count(*) = 7 FROM information_schema.columns WHERE table_schema='public' AND ((table_name='tasks' AND column_name IN ('id','title','completed','priority','category_id')) OR (table_name='categories' AND column_name IN ('id','name'))) AND is_nullable='NO'), 'Обязательные поля NOT NULL');
SELECT pg_temp.assert_true((SELECT data_type='boolean' FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='completed'), 'Тип boolean');
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM pg_constraint WHERE contype='p' AND conrelid IN ('public.tasks'::regclass,'public.categories'::regclass)), 'Первичные ключи');
SELECT pg_temp.assert_true((SELECT EXISTS(SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attname='category_id' WHERE i.indrelid='public.tasks'::regclass AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indkey[0]=a.attnum)), 'Индекс начинается с category_id');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (1,'Другая')$query$, '23505', 'Дубликат PK категории');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (10000,'Учёба')$query$, '23505', 'UNIQUE имени категории');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (10000,NULL)$query$, '23502', 'NULL категории');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (10000,'')$query$, '23514', 'Пустая категория');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (10000,'   ')$query$, '23514', 'Пробельная категория');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (10000,' Учёба ')$query$, '23514', 'Пробелы по краям категории');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (10000,repeat('я',101))$query$, '23514', 'Длинная категория');
SELECT pg_temp.expect_error($query$INSERT INTO public.categories(id,name) VALUES (0,'Нулевая')$query$, '23514', 'Положительный id категории');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (4,'Другая','low',1)$query$, '23505', 'Дубликат PK задачи');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,NULL,'low',1)$query$, '23502', 'NULL названия');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,'','low',1)$query$, '23514', 'Пустое название');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,'   ','low',1)$query$, '23514', 'Пробельное название');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,' X ','low',1)$query$, '23514', 'Пробелы по краям названия');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,repeat('я',101),'low',1)$query$, '23514', 'Длинное название');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (0,'X','low',1)$query$, '23514', 'Положительный id задачи');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,'X','urgent',1)$query$, '23514', 'Недопустимый приоритет');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,'X',NULL,1)$query$, '23502', 'NULL приоритета');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,'X','low',NULL)$query$, '23502', 'NULL category_id');
SELECT pg_temp.expect_error($query$INSERT INTO public.tasks(id,title,priority,category_id) VALUES (10000,'X','low',999)$query$, '23503', 'Внешний ключ INSERT');
SELECT pg_temp.expect_error($query$UPDATE public.tasks SET category_id=999 WHERE id=4$query$, '23503', 'Внешний ключ UPDATE');
SELECT pg_temp.expect_error($query$DELETE FROM public.categories WHERE id=2$query$, '23503,23001', 'Удаление используемой категории запрещено');
SELECT pg_temp.expect_error($query$UPDATE public.tasks SET completed=NULL WHERE id=4$query$, '23502', 'NULL completed');
SELECT pg_temp.expect_error($query$UPDATE public.tasks SET title='Новое',priority='urgent' WHERE id=4$query$, '23514', 'Некорректный UPDATE целиком отклонён');
SELECT pg_temp.assert_true((SELECT title='Подготовить модель задач' AND priority='high' FROM public.tasks WHERE id=4), 'После ошибки строка не изменилась');
SELECT pg_temp.assert_true((SELECT array_agg(id ORDER BY id)=ARRAY[4,34] FROM public.tasks WHERE NOT completed AND priority='high' AND category_id=2), 'Комбинированный фильтр');
SELECT pg_temp.assert_true((SELECT array_agg(id ORDER BY id)=ARRAY[7,16] FROM public.tasks WHERE title ILIKE '%ПРОВЕР%'), 'Поиск по кириллице без учёта регистра');
SELECT pg_temp.assert_true((SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.tasks'::regclass AND confrelid='public.categories'::regclass AND contype='f' AND confdeltype='r')), 'FK имеет ON DELETE RESTRICT');
DO $$
DECLARE first_id integer; second_id integer; new_category integer; status boolean;
BEGIN
 INSERT INTO public.categories(name) VALUES ('Пустая тестовая') RETURNING id INTO new_category;
 PERFORM pg_temp.assert_true(new_category > 3, 'Sequence категорий синхронизирована');
 PERFORM pg_temp.assert_true((SELECT count(t.id)=0 FROM public.categories c LEFT JOIN public.tasks t ON t.category_id=c.id WHERE c.id=new_category), 'LEFT JOIN сохраняет пустую категорию');
 INSERT INTO public.tasks(title,priority,category_id) VALUES (repeat('я',100),'low',1) RETURNING id,completed INTO first_id,status;
 PERFORM pg_temp.assert_true(first_id > 34, 'Sequence задач синхронизирована');
 PERFORM pg_temp.assert_true(status=false, 'completed по умолчанию false; длина 100 разрешена');
 DELETE FROM public.tasks WHERE id=first_id;
 INSERT INTO public.tasks(title,priority,category_id) VALUES ('Следующая','medium',1) RETURNING id INTO second_id;
 PERFORM pg_temp.assert_true(second_id > first_id, 'Удалённый id не используется повторно');
 DELETE FROM public.tasks WHERE id=second_id;
 DELETE FROM public.categories WHERE id=new_category;
END $$;
SELECT n, label, 'PASS' AS result FROM pr11_results ORDER BY n;
SELECT count(*) AS passed FROM pr11_results;
ROLLBACK;
