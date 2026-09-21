import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../../src/config.js';

test('readConfig читает полную корректную конфигурацию', () => {
  const config = readConfig({
    API_PORT: '5513',
    DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/test',
    ENABLE_DEBUG_RESET: 'true',
  });
  assert.equal(config.port, 5513);
  assert.equal(config.connectionString, 'postgresql://user:password@127.0.0.1:5432/test');
  assert.equal(config.enableDebugReset, true);
});

test('readConfig использует безопасные значения по умолчанию', () => {
  const config = readConfig({ DATABASE_URL: 'postgresql://example' });
  assert.equal(config.port, 5505);
  assert.equal(config.enableDebugReset, false);
});

test('readConfig отклоняет отсутствие DATABASE_URL и строку из пробелов', () => {
  assert.throws(() => readConfig({}), /DATABASE_URL/);
  assert.throws(() => readConfig({ DATABASE_URL: '   ' }), /DATABASE_URL/);
});

test('readConfig отклоняет порт вне диапазона и нечисловой порт', () => {
  for (const API_PORT of ['abc', '1.5', '1023', '65536']) {
    assert.throws(() => readConfig({ DATABASE_URL: 'postgresql://x', API_PORT }), /API_PORT/);
  }
});

test('readConfig принимает только true или false для ENABLE_DEBUG_RESET', () => {
  assert.equal(
    readConfig({ DATABASE_URL: 'postgresql://x', ENABLE_DEBUG_RESET: 'false' }).enableDebugReset,
    false,
  );
  assert.throws(
    () => readConfig({ DATABASE_URL: 'postgresql://x', ENABLE_DEBUG_RESET: '1' }),
    /ENABLE_DEBUG_RESET/,
  );
});
