import test from 'node:test';

test.todo('shutdown прекращает приём запросов, закрывает pool и пишет итоговый лог');
test.todo('повторный shutdown возвращает тот же promise и не закрывает ресурсы дважды');
test.todo('shutdown завершается ошибкой после ограниченного таймаута');
