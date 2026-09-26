import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/AppError.js';
import { sendData } from '../lib/respond.js';
import { logger } from '../lib/logger.js';
import { User } from '../models/user.model.js';
import { loginAttempts, isLockedOut, recordFailedLogin, clearLoginFailures } from '../middleware/loginLockout.js';

/** The user fields that are safe to return to a client — never the hash. */
function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  };
}

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    throw AppError.badRequest('username and password are required');
  }

  const normalizedUsername = String(username).toLowerCase().trim();
  const now = Date.now();

  if (isLockedOut(loginAttempts, normalizedUsername, now)) {
    throw AppError.tooManyRequests('too many failed login attempts, try again later');
  }

  const user = await User.findOne({ username: normalizedUsername }).select('+passwordHash');

  // One message for unknown user, wrong password, or deactivated account — no enumeration.
  if (!user || user.active === false || !(await user.verifyPassword(password))) {
    recordFailedLogin(loginAttempts, normalizedUsername, now);
    logger.warn('auth.login.fail', { username });
    throw AppError.unauthorized('invalid credentials');
  }

  clearLoginFailures(loginAttempts, normalizedUsername);
  req.session.user = { id: user.id, role: user.role };
  logger.info('auth.login.success', { userId: user.id });
  sendData(res, publicUser(user));
});

export const logout = asyncHandler(async (req, res) => {
  const userId = req.session?.user?.id ?? null;

  await new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });

  res.clearCookie('connect.sid');
  logger.info('auth.logout', { userId });
  sendData(res, { ok: true });
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  sendData(res, publicUser(req.user));
});
