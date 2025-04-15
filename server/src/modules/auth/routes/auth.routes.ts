import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { ensureAuthenticated } from '../../../core/middleware/auth.middleware';
// import { validateRequest } from '../../../core/middleware/validation.middleware';
import { registerUserSchema } from '../types/auth.schemas';

const router: Router = Router();

// Public routes (no ensureAuthenticated)
router.post('/register', /* validateRequest(registerUserSchema), */ authController.register);
// router.post('/login', /* validateRequest(loginSchema), */ authController.login);

// Routes requiring authentication
router.post('/logout', ensureAuthenticated, authController.logout);
router.get('/status', ensureAuthenticated, authController.status);

export const authRoutes = router;