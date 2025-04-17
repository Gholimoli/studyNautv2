import { Router, type Response, type Request } from 'express';
import { db } from '../../db/index';
import { notes } from '../../db/schema';
import { ensureAuthenticated } from '../../middleware/auth.middleware';
import { eq } from 'drizzle-orm';
import { getUserNotes } from '@/modules/notes/notes.service';
// If you need RequestWithUser, define it here or use Request & { user: ... } inline
// import type { RequestWithUser } from '../../middleware/auth.middleware';

const router: Router = Router();

/**
 * GET /api/notes
 * Retrieves a list of notes for the authenticated user.
 */
router.get('/', ensureAuthenticated, async (req: Request, res: Response): Promise<void> => {
  // req.user should be populated by the 'ensureAuthenticated' middleware
  const user = req.user as { id: number } | undefined;
  if (!user || !user.id) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const userId = user.id;

  // Parse query params for limit/offset/favorite/folderId as needed
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  const favorite = req.query.favorite !== undefined ? req.query.favorite === 'true' : undefined;
  
  // --- Refined folderId Parsing ---
  const folderIdParam = req.query.folderId;
  let folderId: number | undefined = undefined; // Initialize as undefined
  if (folderIdParam !== undefined && typeof folderIdParam === 'string') {
      const parsedId = parseInt(folderIdParam, 10);
      if (!isNaN(parsedId)) {
          folderId = parsedId; // Assign only if it's a valid number
      }
      // Note: We are not handling folderId=null via query param here.
      // Filtering for null folderId usually happens when NO folderId is provided.
  }
  // -----------------------------

  try {
    // Pass the potentially undefined folderId
    const result = await getUserNotes(userId, { limit, offset, favorite, folderId });
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching notes:', error);
    // Log the specific error for debugging
    // Use a generic error message for the client
    res.status(500).json({ message: 'Failed to retrieve notes due to a server error.' });
  }
  // No explicit return needed here; Express handles ending the response.
});

export default router; // Export the router instance
