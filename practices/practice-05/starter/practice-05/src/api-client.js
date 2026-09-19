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

// Создаёт URL относительно baseUrl и добавляет непустые параметры query.
// Значения кодируются средствами URL и URLSearchParams, а не вручную.
export function buildUrl(baseUrl, path, query = {}) {
  void baseUrl;
  void path;
  void query;
  throw new Error("Не реализовано: buildUrl");
}

// fetchFn передаётся явно, чтобы модуль можно было проверить без реальной сети.
// Возвращаемый объект: { requestJson(path, { query, signal, timeoutMs } = {}) }.
export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  void baseUrl;
  void fetchFn;
  void timeoutMs;

  // TODO:
  // 1. Проверить конфигурацию и нормализовать baseUrl.
  // 2. Реализовать асинхронную requestJson.
  // 3. Выполнять GET с Accept: application/json и ограничением времени.
  // 4. Проверять response.ok и Content-Type.
  // 5. Разбирать JSON и преобразовывать ошибки в ApiError.
  // kind: http | network | invalid-response | timeout | aborted.
  // HTTP-ошибка сохраняет status, code, details и url.
  throw new Error("Не реализовано: createApiClient");
}
