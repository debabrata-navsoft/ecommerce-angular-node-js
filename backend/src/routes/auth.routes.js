import { Router } from 'express';
import { body } from 'express-validator';

import {
  changePassword,
  login,
  loginAdmin,
  logout,
  me,
  signup,
  updateMe,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const credentials = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

router.post(
  '/signup',
  [
    body('firstName').isString().trim().notEmpty().withMessage('First name is required'),
    body('lastName').isString().trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('phoneNumber').optional(),
  ],
  validate,
  signup,
);

// Two entry points, one credential store: each rejects the other area's role.
router.post('/login', credentials, validate, login);
router.post('/admin/login', credentials, validate, loginAdmin);

router.post('/logout', logout);

router.get('/me', me);
router.patch('/me', requireAuth, updateMe);

router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  validate,
  changePassword,
);

export default router;
