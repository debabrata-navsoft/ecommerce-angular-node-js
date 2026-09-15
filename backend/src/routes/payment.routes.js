import { Router } from 'express';
import { body } from 'express-validator';

import {
  abandonPayment,
  getPaymentConfig,
  verifyPayment,
} from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/config', getPaymentConfig);

router.use(requireAuth);

router.post(
  '/:orderId/verify',
  [
    body('razorpayPaymentId').isString().notEmpty(),
    body('razorpayOrderId').isString().notEmpty(),
    body('signature').isString().notEmpty(),
  ],
  validate,
  verifyPayment,
);

router.post('/:orderId/abandon', abandonPayment);

export default router;
