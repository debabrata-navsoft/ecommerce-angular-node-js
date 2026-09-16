import { Router } from 'express';

import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from '../controllers/wishlist.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdBody, objectIdParam } from './validators.js';

const router = Router();

router.use(requireAuth);

router.get('/', getWishlist);
router.post('/', objectIdBody('productId'), validate, addToWishlist);
router.delete('/:productId', objectIdParam('productId'), validate, removeFromWishlist);

export default router;
