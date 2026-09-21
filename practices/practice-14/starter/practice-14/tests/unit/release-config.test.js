import test from 'node:test';

test.todo('readConfig читает API_HOST и отклоняет пробельное значение');
test.todo('readConfig применяет безопасные значения NODE_ENV, LOG_LEVEL и RELEASE_VERSION');
test.todo('readConfig отклоняет неизвестные environment, log level и release version');
test.todo('readConfig запрещает ENABLE_DEBUG_RESET=true в production');
