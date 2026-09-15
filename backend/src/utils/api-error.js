export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (details) this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Not authenticated', details) {
    return new ApiError(401, message, details);
  }

  static forbidden(message = 'Not authorized') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found', details) {
    return new ApiError(404, message, details);
  }

  static conflict(message = 'Already exists', details) {
    return new ApiError(409, message, details);
  }

  static unavailable(message = 'Service unavailable') {
    return new ApiError(503, message);
  }
}
