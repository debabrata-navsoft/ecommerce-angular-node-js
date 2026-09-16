import mongoose from 'mongoose';

import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
}

function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest(
      'Validation failed',
      Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    );
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
    return ApiError.conflict(`A record with that ${field} already exists`);
  }

  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Invalid or expired session');
  }

  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON body');
  }

  return null;
}

export function errorHandler(err, _req, res, _next) {
  const known = normalize(err);

  if (!known) {
    console.error('[error]', err);
    return res.status(500).json({
      message: isProduction ? 'Internal server error' : (err?.message ?? 'Internal server error'),
      ...(isProduction ? {} : { stack: err?.stack }),
    });
  }

  res.status(known.status).json({
    message: known.message,
    ...(known.details ? { details: known.details } : {}),
  });
}
