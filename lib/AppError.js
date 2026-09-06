/**
 * An error that is safe to surface to the client: carries an HTTP status and a
 * short machine code. Anything thrown that is NOT an AppError is treated as a
 * 500 and its message is never sent to the client.
 */
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message = 'bad request') {
    return new AppError(400, 'bad_request', message);
  }

  static unauthorized(message = 'unauthorized') {
    return new AppError(401, 'unauthorized', message);
  }

  static forbidden(message = 'forbidden') {
    return new AppError(403, 'forbidden', message);
  }

  static notFound(message = 'not found') {
    return new AppError(404, 'not_found', message);
  }

  static conflict(message = 'conflict') {
    return new AppError(409, 'conflict', message);
  }

  static tooManyRequests(message = 'too many requests') {
    return new AppError(429, 'rate_limited', message);
  }

  static serviceUnavailable(message = 'service unavailable') {
    return new AppError(503, 'service_unavailable', message);
  }
}
