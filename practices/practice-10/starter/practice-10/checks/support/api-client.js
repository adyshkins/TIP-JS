// Готовый транспорт ПР8. При переносе собственного решения ПР6 сохранить контракт.
export class ApiError extends Error {
  constructor(message, { kind, status = null, code = null, details = null, url = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ApiError';
    Object.assign(this, { kind, status, code, details, url });
  }
}
export function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(baseUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, ''));
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Нужен HTTP(S)-адрес API.');
  for (const [key, value] of Object.entries(query)) {
    if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}
export function createApiClient({ baseUrl, fetchFn = globalThis.fetch, timeoutMs = 3000 } = {}) {
  buildUrl(baseUrl, '');
  return { async requestJson(path, { method = 'GET', query = {}, body, signal, timeoutMs: limit = timeoutMs } = {}) {
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) throw new TypeError('Неверный метод.');
    if (method === 'GET' && body !== undefined) throw new TypeError('GET не принимает тело.');
    if (!Number.isFinite(limit) || limit <= 0) throw new TypeError('Тайм-аут должен быть положительным.');
    const url = buildUrl(baseUrl, path, query).href;
    const controller = new AbortController();
    let abortKind = null;
    const abort = kind => {
      if (controller.signal.aborted) return;
      abortKind = kind;
      controller.abort();
    };
    const onAbort = () => abort('aborted');
    if (signal?.aborted) onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => abort('timeout'), limit);
    try {
      if (controller.signal.aborted) throw new Error('Отмена');
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetchFn(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      if (!response.ok) {
        let payload;
        try { payload = await response.json(); } catch { /* Статус важнее формата тела ошибки. */ }
        throw new ApiError(payload?.error?.message || `HTTP ${response.status}`, {
          kind: 'http', status: response.status, code: payload?.error?.code ?? null,
          details: payload?.error?.details ?? null, url,
        });
      }
      if (response.status === 204) return null;
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
        throw new ApiError('Ответ не является JSON.', { kind: 'invalid-response', url });
      }
      try { return await response.json(); }
      catch (cause) { throw new ApiError('Повреждён JSON.', { kind: 'invalid-response', url, cause }); }
    } catch (cause) {
      if (abortKind) throw new ApiError(abortKind === 'timeout' ? 'Истекло время ожидания.' : 'Запрос отменён.', { kind: abortKind, url, cause });
      if (cause instanceof ApiError) throw cause;
      throw new ApiError('Сеть недоступна.', { kind: 'network', url, cause });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  } };
}
