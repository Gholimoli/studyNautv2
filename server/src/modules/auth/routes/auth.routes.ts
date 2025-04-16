import { Router } from 'express';
import passport from 'passport';
import { authController } from '../controllers/auth.controller';
import { ensureAuthenticated } from '../../../core/middleware/auth.middleware';
// import { validateRequest } from '../../../core/middleware/validation.middleware';
// import { loginSchema } from '../types/auth.schemas'; // Assuming loginSchema is defined here
import { registerUserSchema } from '../types/auth.schemas';

const router: Router = Router();

// Public routes (no ensureAuthenticated)
router.post('/register', /* validateRequest(registerUserSchema), */ authController.register);

// Use passport.authenticate middleware for the login route
router.post(
    '/login', 
    // Optional: Add validation middleware here first if needed
    // validateRequest(loginSchema), 
    passport.authenticate('local', { 
        // Optional: failureRedirect: '/login', // Can redirect, but API usually sends 401
        // failureMessage: true // Can add failure messages to session if desired
    }), 
    authController.login // This only runs if passport.authenticate succeeds
);

// Routes requiring authentication
router.post('/logout', ensureAuthenticated, authController.logout);
router.get('/status', ensureAuthenticated, authController.status);

export const authRoutes = router;