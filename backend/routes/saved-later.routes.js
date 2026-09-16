import { Router } from 'express';

import {
  addToSavedLater,
  getSavedLater,
  moveToCart,
  removeFromSavedLater,
} from '../controllers/saved-later.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdBody, objectIdParam } from './validators.js';

const router = Router();

router.use(requireAuth);

router.get('/', getSavedLater);
router.post('/', objectIdBody('productId'), validate, addToSavedLater);
router.delete('/:productId', objectIdParam('productId'), validate, removeFromSavedLater);

router.post('/:productId/move-to-cart', objectIdParam('productId'), validate, moveToCart);

export default router;
