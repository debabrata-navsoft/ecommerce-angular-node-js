import crypto from 'node:crypto';

import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { sendPasswordResetEmail } from '../services/mailer.js';
import { ApiError } from '../utils/api-error.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/token.js';

function issueSession(res, user) {
  setAuthCookie(res, signToken(user));
  return user.toJSON();
}

const asArray = (value) => (Array.isArray(value) ? value : [value].filter(Boolean));

export async function signup(req, res) {
  const { firstName, lastName, email, password, phoneNumber } = req.body;

  if (await User.exists({ email: email.toLowerCase() })) {
    throw ApiError.conflict(
      'That email is already registered',
      fieldError('email', 'This email is already registered. Try logging in instead.'),
    );
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash: await User.hashPassword(password),
    phoneNumber: asArray(phoneNumber),
    role: 'user',
  });

  res.status(201).json({ user: issueSession(res, user) });
}

const fieldError = (field, message) => [{ field, message }];

const loginAs = (expectedRole) => async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  if (!user) {
    throw ApiError.unauthorized(
      'This email is not registered',
      fieldError('email', 'This email is not registered. Please sign up first.'),
    );
  }

  if (!(await user.comparePassword(password))) {
    throw ApiError.unauthorized(
      'Incorrect password',
      fieldError('password', 'Incorrect password. Please try again.'),
    );
  }

  if (user.role !== expectedRole) {
    throw ApiError.forbidden(
      expectedRole === 'admin'
        ? 'This account is not an admin account'
        : 'Use the admin login for this account',
    );
  }

  user.passwordHash = undefined;
  res.json({ user: issueSession(res, user) });
};

export const login = loginAs('user');
export const loginAdmin = loginAs('admin');

export async function logout(_req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: req.user ? req.user.toJSON() : null });
}

export function profileChanges({ firstName, lastName, phoneNumber }) {
  const changes = {};
  if (firstName !== undefined) changes.firstName = firstName;
  if (lastName !== undefined) changes.lastName = lastName;
  if (phoneNumber !== undefined) changes.phoneNumber = asArray(phoneNumber);
  return changes;
}

export async function updateMe(req, res) {
  const user = await User.findByIdAndUpdate(req.user._id, profileChanges(req.body), {
    new: true,
    runValidators: true,
  });

  res.json({ user: user.toJSON() });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.unauthorized(
      'Current password is incorrect',
      fieldError('currentPassword', 'Current password is incorrect'),
    );
  }

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  // Re-issue so the existing cookie keeps working after the change.
  setAuthCookie(res, signToken(user));
  res.status(204).end();
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw ApiError.notFound(
      'This email is not registered',
      fieldError('email', 'This email is not registered. Please sign up first.'),
    );
  }

  const token = crypto.randomBytes(32).toString('hex');

  user.resetTokenHash = hashResetToken(token);
  user.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  void sendPasswordResetEmail(user.email, `${env.appUrl}/reset-password?token=${token}`);

  res.status(204).end();
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetTokenHash: hashResetToken(token),
    resetTokenExpiresAt: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpiresAt');

  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');
  }

  user.passwordHash = await User.hashPassword(password);
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();

  res.status(204).end();
}
