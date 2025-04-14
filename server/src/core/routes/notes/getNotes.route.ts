import { Router, type Response } from 'express';
import { db } from '@server/db';
import { notesTable } from '@server/db/schema';
import { protect } from '@server/core/auth';
import { eq } from 'drizzle-orm';
import type { RequestWithUser } from '@server/core/auth/auth.types'; // Assuming this type exists

const router = Router();

/**
 * GET /api/notes
 * Retrieves a list of notes for the authenticated user.
 */
router.get('/', protect, async (req: RequestWithUser, res: Response): Promise<void> => {
  // req.user should be populated by the 'protect' middleware
  if (!req.user || !req.user.id) {
    // This check might be redundant if 'protect' guarantees req.user exists on success
    // but acts as a type guard and safety net.
    res.status(401).json({ message: 'User not authenticated properly.' });
    return; // Explicit return void
  }

  const userId = req.user.id;

  try {
    const userNotes = await db
      .select({
        id: notesTable.id,
        title: notesTable.title,
        // TODO: Add contentPreview when schema supports it
        createdAt: notesTable.createdAt,
        updatedAt: notesTable.updatedAt,
        // Add other relevant fields like isArchived, tags, etc.
      })
      .from(notesTable)
      .where(eq(notesTable.userId, userId))
      .orderBy(notesTable.updatedAt); // Consider making sort order configurable?

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
