import { Router } from 'express';
import { body } from 'express-validator';

import {
  cancelMyOrder,
  getOrder,
  listAllOrders,
  listMyOrders,
  placeOrder,
  updateOrderStatus,
} from '../controllers/order.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addressRules } from './validators.js';

const router = Router();

router.use(requireAuth);

router.get('/', listMyOrders);

// Admin listing lives on its own path so it cannot be reached by adding a query param
// to the customer's own-orders route.
router.get('/all', requireAdmin, listAllOrders);

router.post(
  '/',
  [
    ...addressRules('address'),
    body('shippingMethod').optional().isIn(['free', 'express']),
    body('paymentMethod').isIn(['cod', 'upi', 'card', 'emi', 'netbanking']),
  ],
  validate,
  placeOrder,
);

router.get('/:orderId', getOrder);
router.post('/:orderId/cancel', cancelMyOrder);

router.patch(
  '/:orderId/status',
  requireAdmin,
  body('status').isIn(['pending', 'shipped', 'delivered', 'cancelled']),
  validate,
  updateOrderStatus,
);

export default router;
