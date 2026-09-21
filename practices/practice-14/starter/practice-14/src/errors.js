export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function notImplemented(name) {
  throw new ApiError(501, 'NOT_IMPLEMENTED', `Не реализовано: ${name}`);
}

function databaseError(error) {
  if (error instanceof ApiError) {
    return error;
  }
  if (error?.code === '23503') {
    return new ApiError(400, 'VALIDATION_ERROR', 'Указанная категория не существует.', {
      categoryId: 'Категория не найдена.',
    });
  }
  if (['23502', '23514', '22001'].includes(error?.code)) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Данные не соответствуют ограничениям базы.');
  }
  if (typeof error?.code === 'string' && (error.code.startsWith('08') || error.code === '57P01')) {
    return new ApiError(503, 'DATABASE_UNAVAILABLE', 'База данных временно недоступна.');
  }
  return error;
}

export function errorHandler(sourceError, req, res, next) {
  if (res.headersSent) {
    return next(sourceError);
  }

  const parserErrors = {
    'entity.parse.failed': [400, 'INVALID_JSON', 'Некорректный JSON.'],
    'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'Тело запроса превышает 16 КиБ.'],
    'charset.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'Неподдерживаемая кодировка.'],
    'encoding.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'Сжатые тела не поддерживаются.'],
    'request.size.invalid': [400, 'INVALID_JSON', 'Некорректный размер тела.'],
    'request.aborted': [400, 'INVALID_JSON', 'Передача тела прервана.'],
  };

  let error = sourceError;
  if (!(error instanceof ApiError) && Object.hasOwn(parserErrors, error?.type ?? '')) {
    const [status, code, message] = parserErrors[error.type];
    error = new ApiError(status, code, message);
  } else {
    error = databaseError(error);
  }

  const invalidUri = error instanceof URIError;
  const known = error instanceof ApiError;
  const status = invalidUri ? 400 : known ? error.status : 500;
  const payload = {
    code: invalidUri ? 'INVALID_ID' : known ? error.code : 'INTERNAL_ERROR',
    message: invalidUri
      ? 'Некорректное кодирование id.'
      : known
        ? error.message
        : 'Внутренняя ошибка API.',
  };
  if (known && error.details !== undefined) {
    payload.details = error.details;
  }
  res.status(status).json({ error: payload });
}
