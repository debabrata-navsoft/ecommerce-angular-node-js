import { User } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { readToken, verifyToken } from '../utils/token.js';

export async function authenticate(req, _res, next) {
  req.user = null;

  const token = readToken(req);
  if (!token) return next();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next();
  }

  const user = await User.findById(payload.sub);
  if (user) req.user = user;

  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

export const requireAdmin = requireRole('admin');

export function requireSelfOrAdmin(param = 'id') {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();
    if (String(req.user._id) === String(req.params[param])) return next();
    next(ApiError.forbidden());
  };
}
