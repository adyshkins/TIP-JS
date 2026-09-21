import express from 'express';
import { ApiError } from './errors.js';

const parse = express.json({
  limit: 16 * 1024,
  strict: false,
  inflate: false,
  verify(req, res, buffer) {
    req.jsonBodyBytes = buffer.length;
  },
});

export const jsonBody = [
  (req, res, next) => {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
      return next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Нужен Content-Type application/json.'));
    }
    next();
  },
  parse,
  (req, res, next) => {
    if (!req.jsonBodyBytes) return next(new ApiError(400, 'INVALID_JSON', 'Пустое тело запроса.'));
    next();
  },
];
