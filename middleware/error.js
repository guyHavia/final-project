import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';

/** Reached only when no route matched. */
export function notFound(req, res, next) {
  next(AppError.notFound('route not found'));
}

/**
 * Terminal error handler. Must be the last `app.use`.
 * Known errors → their status + envelope. Everything else → 500, message hidden.
 */
// eslint-disable-next-line no-unused-vars -- Express detects error handlers by arity (4 args)
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ error: { message: err.message, code: err.code } });
  }

  if (err?.name === 'ValidationError') {
    return res
      .status(400)
      .json({ error: { message: 'validation failed', code: 'validation' } });
  }

  if (err?.name === 'CastError') {
    return res
      .status(400)
      .json({ error: { message: 'invalid identifier', code: 'invalid_id' } });
  }

  if (err?.code === 11000) {
    return res
      .status(409)
      .json({ error: { message: 'duplicate value', code: 'duplicate' } });
  }

  logger.error('http.unhandled_error', { message: err?.message, stack: err?.stack });
  return res
    .status(500)
    .json({ error: { message: 'internal server error', code: 'internal' } });
}
