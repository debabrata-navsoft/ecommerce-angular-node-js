import { User } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/token.js';

/**
 * The customer and admin areas keep separate entry points over one credential store: each
 * login route accepts exactly one role and refuses the other, so an admin credential
 * cannot open a customer session or vice versa.
 */
function issueSession(res, user) {
  setAuthCookie(res, signToken(user));
  return user.toJSON();
}

const asArray = (value) => (Array.isArray(value) ? value : [value].filter(Boolean));

export async function signup(req, res) {
  const { firstName, lastName, email, password, phoneNumber } = req.body;

  if (await User.exists({ email: email.toLowerCase() })) {
    throw ApiError.conflict('That email is already registered');
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

const loginAs = (expectedRole) => async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  // Same message whether the email is unknown or the password is wrong, so the endpoint
  // cannot be used to enumerate registered addresses.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
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

/** Only these three fields; role and addresses have their own routes. */
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
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  // Re-issue so the existing cookie keeps working after the change.
  setAuthCookie(res, signToken(user));
  res.status(204).end();
}
