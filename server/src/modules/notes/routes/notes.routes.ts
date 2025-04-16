/// <reference types="../../../types/express" />
// Note: Keep the triple-slash directive for build-time checking

import { Router, Request, Response, NextFunction } from 'express';
// Removed direct db/schema imports
import { ensureAuthenticated } from '@server/core/middleware/auth.middleware';
import { z } from 'zod';
// Import service functions
import { getUserNotes, getNoteById, updateNote, deleteNote } from '../notes.service'; // Added updateNote, deleteNote

const router: Router = Router();

// Define local interface as workaround for type augmentation issues
// TODO: Ideally, use proper Express/Passport type augmentation
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    // Add other fields if needed, matching what ensureAuthenticated provides
  };
}

// --- Get Notes List --- //

const GetNotesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  favorite: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

// Use the explicit AuthenticatedRequest type
const getNotesListHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    // This check might be redundant if ensureAuthenticated guarantees req.user
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
    // Call the service function
    const result = await getUserNotes(userId, { limit, offset, favorite });
    res.status(200).json(result); // Send the { notes, total } object

  } catch (error) {
    console.error('Error fetching notes list:', error);
    // Pass error to a central handler eventually
    // For now, send a generic error
    if (!res.headersSent) {
       res.status(500).json({ message: 'Failed to fetch notes list' });
    } else {
        next(error); // If headers sent, pass to default handler
    }
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
    // Call the service function
    const note = await getNoteById(noteId, userId);

    if (!note) {
      res.status(404).json({ message: 'Note not found' });
      return;
    }

    res.status(200).json(note); // Send the detailed note object

  } catch (error) {
    console.error(`Error fetching note with ID ${noteId}:`, error);
    if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to fetch note' });
    } else {
        next(error); // Pass to default handler
    }
  }
};

// --- Schemas --- //
const NoteIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Schema for validating the PATCH request body
const UpdateNoteBodySchema = z.object({
    favorite: z.boolean().optional(),
    folderId: z.number().int().positive().nullable().optional(),
    // Only allow favorite and folderId for now
}).strict(); // Use strict to prevent extra fields

// --- Handlers --- //

// PATCH /:id Handler
const updateNoteHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const paramsValidation = NoteIdParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    res.status(400).json({ message: 'Invalid note ID', errors: paramsValidation.error.format() });
    return;
  }
  const { id: noteId } = paramsValidation.data;

  const bodyValidation = UpdateNoteBodySchema.safeParse(req.body);
  if (!bodyValidation.success) {
    res.status(400).json({ message: 'Invalid request body', errors: bodyValidation.error.format() });
    return;
  }
  const updateData = bodyValidation.data;

  // Check if there's actually anything to update
  if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: 'No update fields provided.' });
      return;
  }

  try {
    const updatedNote = await updateNote(noteId, userId, updateData);
    if (!updatedNote) {
      res.status(404).json({ message: 'Note not found or not authorized to update.' });
      return;
    }
    res.status(200).json(updatedNote);
  } catch (error) {
      console.error(`Error updating note ${noteId}:`, error);
      if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to update note.' });
      } else {
          next(error); // Pass to default handler
      }
  }
};

// DELETE /:id Handler
const deleteNoteHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const paramsValidation = NoteIdParamsSchema.safeParse(req.params);
  if (!paramsValidation.success) {
    res.status(400).json({ message: 'Invalid note ID', errors: paramsValidation.error.format() });
    return;
  }
  const { id: noteId } = paramsValidation.data;

  try {
    // We don't strictly need the result here, but could use it to check if deletion occurred
    await deleteNote(noteId, userId);
    res.status(204).send(); // Success - No Content

  } catch (error) {
      console.error(`Error deleting note ${noteId}:`, error);
      if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to delete note.' });
      } else {
          next(error); // Pass to default handler
      }
  }
};

// --- Register Routes --- //

// Apply auth middleware to all routes in this file
router.use(ensureAuthenticated);

// GET routes
router.get('/', (req, res, next) => getNotesListHandler(req as AuthenticatedRequest, res, next));
router.get('/:id', (req, res, next) => getNoteByIdHandler(req as AuthenticatedRequest, res, next));

// PATCH route
router.patch('/:id', (req, res, next) => updateNoteHandler(req as AuthenticatedRequest, res, next));

// DELETE route
router.delete('/:id', (req, res, next) => deleteNoteHandler(req as AuthenticatedRequest, res, next));

export const notesRoutes = router; 