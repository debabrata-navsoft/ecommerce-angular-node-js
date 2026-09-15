import { Router } from 'express';

import {
  createProduct,
  deleteProduct,
  getProduct,
  listBestSellers,
  listDiscounted,
  listProducts,
  listTodayDeals,
  listTrending,
  updateProduct,
} from '../controllers/product.controller.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam, productRules } from './validators.js';

const router = Router();

// Public reads. The curated feeds sit under /feed so they cannot collide with an id.
router.get('/', listProducts);
router.get('/feed/trending', listTrending);
router.get('/feed/best-sellers', listBestSellers);
router.get('/feed/today-deals', listTodayDeals);
router.get('/feed/discounted', listDiscounted);
router.get('/:id', objectIdParam('id'), validate, getProduct);

// Admin writes.
router.post('/', requireAdmin, productRules(), validate, createProduct);
router.patch(
  '/:id',
  requireAdmin,
  [objectIdParam('id'), ...productRules({ partial: true })],
  validate,
  updateProduct,
);
router.delete('/:id', requireAdmin, objectIdParam('id'), validate, deleteProduct);

export default router;
