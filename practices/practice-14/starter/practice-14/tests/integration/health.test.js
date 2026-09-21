import test from 'node:test';

test.todo('GET /health/live отвечает 200 без обращения к PostgreSQL');
test.todo('GET /health/ready отвечает 200 и сообщает версию при доступной базе');
test.todo('GET /health/ready отвечает 503 без внутренних деталей при отказе базы');
