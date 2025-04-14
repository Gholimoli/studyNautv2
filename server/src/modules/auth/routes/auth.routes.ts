import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { ensureAuthenticated } from '@/core/middleware/auth.middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/status', authController.status);
router.post('/logout', ensureAuthenticated, authController.logout);

export const authRoutes = router;