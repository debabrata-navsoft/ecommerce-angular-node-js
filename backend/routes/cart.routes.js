import { Router } from 'express';
import { body } from 'express-validator';

import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  saveForLater,
  updateCartQuantity,
} from '../controllers/cart.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdBody, objectIdParam } from './validators.js';

const router = Router();

// Every list is scoped to the signed-in user; there is no userId in any path.
router.use(requireAuth);

router.get('/', getCart);
router.post('/', objectIdBody('productId'), validate, addToCart);
router.delete('/', clearCart);

router.patch(
  '/:productId',
  [objectIdParam('productId'), body('quantity').isInt({ min: 0 }).toInt()],
  validate,
  updateCartQuantity,
);
router.delete('/:productId', objectIdParam('productId'), validate, removeFromCart);

router.post('/:productId/save-for-later', objectIdParam('productId'), validate, saveForLater);

export default router;
