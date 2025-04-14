import { Router } from 'express';
import { mediaController } from '../controllers/media.controller';
import { ensureAuthenticated } from '@/core/middleware/auth.middleware';

const router = Router();

// All media routes require authentication
router.use(ensureAuthenticated);

router.post('/text', mediaController.processText);
// Add routes for /youtube, /upload later

export const mediaRoutes = router; 