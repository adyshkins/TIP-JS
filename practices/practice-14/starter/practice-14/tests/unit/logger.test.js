import test from 'node:test';

test.todo('logger пишет одну JSON-запись с обязательными полями');
test.todo('logger отбрасывает события ниже настроенного уровня');
test.todo('logger скрывает password, authorization, cookie и connectionString');
test.todo('requestLogger возвращает X-Request-Id и фиксирует метод, путь, статус и durationMs');
