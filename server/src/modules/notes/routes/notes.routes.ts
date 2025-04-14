/// <reference types="../../../types/express" />
// Note: Keep the triple-slash directive for build-time checking

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '@server/core/db';
import { notes } from '@server/core/db/schema';
import { ensureAuthenticated } from '@server/core/middleware/auth.middleware';
import { eq, and, desc, count } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Define local interface as workaround for type augmentation issues
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string; // Add other fields from your User type
    email: string;
    role: string;
  };
}

// --- Get Notes List --- //

const GetNotesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  favorite: z.enum(['true', 'false']).optional().transform(val => val === 'true'), // Assumes schema has favorite
});

// Use the explicit AuthenticatedRequest type
const getNotesListHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const validation = GetNotesListQuerySchema.safeParse(req.query);
  if (!validation.success) {
    res.status(400).json({ message: 'Invalid query parameters', errors: validation.error.format() });
    return;
  }

  const { limit, offset, favorite } = validation.data;

  try {
    const conditions = [eq(notes.userId, userId)];
    if (favorite !== undefined) {
      conditions.push(eq(notes.favorite, favorite)); // Requires notes.favorite in schema
    }
    const whereCondition = and(...conditions);

    const notesList = await db
      .select({
        id: notes.id,
        sourceId: notes.sourceId,
        userId: notes.userId,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        favorite: notes.favorite,
      })
      .from(notes)
      .where(whereCondition)
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ total: count() })
      .from(notes)
      .where(whereCondition);

    const total = totalResult[0]?.total ?? 0;

    res.status(200).json({
      notes: notesList,
      total,
    });

  } catch (error) {
    console.error('Error fetching notes list:', error);
    res.status(500).json({ message: 'Failed to fetch notes list' });
    // next(error); // Pass to a global error handler eventually
  }
};

// --- Get Note By ID --- //

const GetNoteParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Use the explicit AuthenticatedRequest type
const getNoteByIdHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const paramsValidation = GetNoteParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    res.status(400).json({ message: 'Invalid note ID', errors: paramsValidation.error.format() });
    return;
  }

  const { id: noteId } = paramsValidation.data;

  try {
    const noteResult = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);

    if (noteResult.length === 0) {
      res.status(404).json({ message: 'Note not found' });
      return;
    }

    res.status(200).json(noteResult[0]);

  } catch (error) {
    console.error(`Error fetching note with ID ${noteId}:`, error);
    res.status(500).json({ message: 'Failed to fetch note' });
    // next(error); // Pass to a global error handler eventually
  }
};

// --- Register Routes --- //

router.use(ensureAuthenticated);

// Use wrapper functions for route handlers
router.get('/', (req, res, next) => getNotesListHandler(req as AuthenticatedRequest, res, next));
router.get('/:id', (req, res, next) => getNoteByIdHandler(req as AuthenticatedRequest, res, next));

export const notesRoutes = router; 