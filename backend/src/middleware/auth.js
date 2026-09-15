import { User } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { readToken, verifyToken } from '../utils/token.js';

/**
 * Populates req.user when a valid token is present and otherwise does nothing, so public
 * endpoints can vary their response for signed-in visitors. An expired or tampered token
 * is treated as anonymous rather than an error — requireAuth is what rejects.
 */
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

  // Re-read the user so a role change or deletion takes effect immediately instead of
  // waiting for the token to expire.
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

/** Lets a user read/write their own sub-resources while admins reach anyone's. */
export function requireSelfOrAdmin(param = 'id') {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();
    if (String(req.user._id) === String(req.params[param])) return next();
    next(ApiError.forbidden());
  };
}
