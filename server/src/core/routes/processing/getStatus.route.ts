import { Router, type Response, type Request } from 'express';
import { param, validationResult } from 'express-validator';
import { db } from '../../db';
import { sources } from '../../db/schema';
import { ensureAuthenticated } from '../../middleware/auth.middleware';
import { eq, and } from 'drizzle-orm';

// Define local interface as workaround for type augmentation issues
interface AuthenticatedRequest extends Request {
  user?: { id: number; /* Add other needed user props */ };
}

const router = Router();

/**
 * GET /api/processing/status/:sourceId
 * Retrieves the processing status of a specific source for the authenticated user.
 */
router.get(
  '/status/:sourceId',
  ensureAuthenticated,
  param('sourceId').isInt({ min: 1 }).withMessage('Source ID must be a positive integer.'),
  (req, res, next) => {
    (async () => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const authReq = req as AuthenticatedRequest;

      if (!authReq.user || !authReq.user.id) {
        res.status(401).json({ message: 'User not properly authenticated.' });
        return;
      }

      const sourceId = parseInt(req.params.sourceId, 10);
      const userId = authReq.user.id;

      try {
        const sourceStatus = await db
          .select({
            sourceId: sources.id,
            processingStatus: sources.processingStatus,
            processingStage: sources.processingStage,
            processingError: sources.processingError,
          })
          .from(sources)
          .where(
            and(
              eq(sources.id, sourceId),
              eq(sources.userId, userId)
            )
          )
          .limit(1);

        if (sourceStatus.length === 0) {
          res.status(404).json({ message: 'Source not found or access denied.' });
          return;
        }

        res.status(200).json(sourceStatus[0]);
      } catch (error) {
        console.error(`Error fetching status for source ${sourceId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve processing status due to a server error.' });
      }
    })().catch(next);
  }
);

export default router;