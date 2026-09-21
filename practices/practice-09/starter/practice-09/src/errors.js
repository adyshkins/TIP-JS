// Общие ошибки и инфраструктура предоставлены. Тексты ошибок могут отличаться.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
export function notImplemented(name) {
  throw new ApiError(501, 'NOT_IMPLEMENTED', `Не реализовано: ${name}`);
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  // Express декодирует :id до вызова маршрута.
  const invalidUri = error instanceof URIError;
  const known = error instanceof ApiError;
  const status = invalidUri ? 400 : known ? error.status : 500;
  const payload = {
    code: invalidUri ? 'INVALID_ID' : known ? error.code : 'INTERNAL_ERROR',
    message: invalidUri ? 'Некорректное кодирование id.' : known ? error.message : 'Внутренняя ошибка API.',
  };
  if (known && error.details !== undefined) payload.details = error.details;
  res.status(status).json({ error: payload });
}
