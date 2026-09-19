export class ApiError extends Error {
  constructor(message, {
    kind,
    status = null,
    code = null,
    details = null,
    url = null,
    cause,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

// Соединяет абсолютный baseUrl, путь и непустые query-параметры.
export function buildUrl(baseUrl, path, query = {}) {
  void baseUrl;
  void path;
  void query;
  throw new Error("Не реализовано: buildUrl");
}

// requestJson(path, { method, query, body, signal, timeoutMs } = {})
// поддерживает GET, POST, PATCH и DELETE; ответ 204 преобразуется в null.
export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 3000,
} = {}) {
  void baseUrl;
  void fetchFn;
  void timeoutMs;

  // Перенесите решение ПР5 и расширьте его:
  // 1. Разрешите только GET, POST, PATCH и DELETE.
  // 2. Для body выполните JSON.stringify и добавьте Content-Type: application/json.
  // 3. Не допускайте body у GET и не добавляйте Content-Type без тела.
  // 4. Сохраните Accept, тайм-аут, внешний AbortSignal и виды ApiError из ПР5.
  // 5. Проверяйте HTTP-ошибку до Content-Type успешного ответа.
  // 6. Для статуса 204 возвращайте null, не пытаясь прочитать JSON.
  throw new Error("Не реализовано: createApiClient");
}
