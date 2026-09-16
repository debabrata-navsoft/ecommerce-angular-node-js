import { validationResult } from 'express-validator';

import { ApiError } from '../utils/api-error.js';

export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  next(
    ApiError.badRequest(
      'Validation failed',
      result.array().map((e) => ({ field: e.path, message: e.msg })),
    ),
  );
}
