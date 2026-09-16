import { validationResult } from 'express-validator';

import { ApiError } from '../utils/api-error.js';

/** Place after a chain of express-validator rules to turn failures into a 400. */
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
