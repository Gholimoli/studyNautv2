import { Router, type Response, type Request } from 'express';
import { db } from '../../db/index';
import { notes } from '../../db/schema';
import { ensureAuthenticated } from '../../middleware/auth.middleware';
import { eq } from 'drizzle-orm';
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

  try {
    const userNotes = await db
      .select({
        id: notes.id,
        title: notes.title,
        // TODO: Add contentPreview when schema supports it
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        // Add other relevant fields like isArchived, tags, etc.
      })
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(notes.updatedAt); // Consider making sort order configurable?

    // Send the response
    res.status(200).json(userNotes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    // Log the specific error for debugging
    // Use a generic error message for the client
    res.status(500).json({ message: 'Failed to retrieve notes due to a server error.' });
  }
  // No explicit return needed here; Express handles ending the response.
});

export default router; // Export the router instance
