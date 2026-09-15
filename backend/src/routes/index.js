import { Router } from 'express';
import mongoose from 'mongoose';

import authRoutes from './auth.routes.js';
import cartRoutes from './cart.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import productRoutes from './product.routes.js';
import savedLaterRoutes from './saved-later.routes.js';
import userRoutes from './user.routes.js';
import wishlistRoutes from './wishlist.routes.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    uptime: process.uptime(),
  });
});

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/users', userRoutes);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/saved-later', savedLaterRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);

export default router;
