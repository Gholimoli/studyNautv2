import { Router, Request, Response, NextFunction } from 'express';
import { getUserFolders, createFolder, updateFolder, deleteFolder, getFolderById } from './folders.service';
import { ensureAuthenticated } from '@/core/middleware/auth.middleware';
import { createFolderSchema, updateFolderSchema } from './folders.validation';
// Remove UserSchema import if not needed for other routes in this file later
// import { users as UserSchema } from '@/core/db/schema'; 
import { ParsedQs } from 'qs';

// Define a basic type for the user attached by passport
type AuthenticatedUser = {
  id: number;
  // Add other fields if needed elsewhere, but id is key here
};

const router: Router = Router();

// GET /api/folders - Fetch folders for the authenticated user
router.get('/', ensureAuthenticated, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Cast req.user after ensureAuthenticated has run
    const user = req.user as AuthenticatedUser;

    // Double-check the id just in case, though middleware should handle absence
    if (typeof user?.id !== 'number') {
      console.error('User ID is not a number after authentication middleware:', user);
      res.status(401).json({ message: 'Invalid user authentication data.' });
      return; // Explicitly return void
    }

    const userId = user.id;
    const folders = await getUserFolders(userId);
    res.status(200).json({ folders });
    // No explicit return needed here as res.json() ends the response

  } catch (error) {
    next(error); // Pass errors to the global error handler
  }
});

// GET /api/folders/:folderId - Fetch a specific folder by ID
router.get('/:folderId', ensureAuthenticated, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    const folderId = parseInt(req.params.folderId, 10);

    if (isNaN(folderId)) {
      res.status(400).json({ message: 'Invalid folder ID.' });
      return;
    }
    if (typeof user?.id !== 'number') {
      res.status(401).json({ message: 'Invalid user authentication data.' });
      return;
    }

    const folder = await getFolderById(user.id, folderId);

    if (!folder) {
      res.status(404).json({ message: 'Folder not found.' });
      return;
    }

    res.status(200).json(folder);
  } catch (error) {
    next(error); // Pass errors to the global error handler
  }
});

// POST /api/folders - Create a new folder
router.post('/', ensureAuthenticated, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as AuthenticatedUser;
        const validatedInput = createFolderSchema.parse(req.body); // Validate input

        if (typeof user?.id !== 'number') {
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return;
        }
        
        const newFolder = await createFolder(user.id, validatedInput);
        
        res.status(201).json(newFolder);
    } catch (error) {
        next(error); // Pass validation or service errors to global handler
    }
});

// PATCH /api/folders/:folderId - Update a folder (rename, move)
router.patch('/:folderId', ensureAuthenticated, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as AuthenticatedUser;
        const folderId = parseInt(req.params.folderId, 10);
        const validatedInput = updateFolderSchema.parse(req.body); // Validate input

        if (isNaN(folderId)) {
            res.status(400).json({ message: 'Invalid folder ID.' });
            return;
        }
        if (typeof user?.id !== 'number') {
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return;
        }

        const updatedFolder = await updateFolder(user.id, folderId, validatedInput);

        res.status(200).json(updatedFolder);
    } catch (error) {
        next(error); // Pass validation or service errors to global handler
    }
});

// DELETE /api/folders/:folderId - Delete a folder
router.delete('/:folderId', ensureAuthenticated, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user as AuthenticatedUser;
        const folderId = parseInt(req.params.folderId, 10);

        if (isNaN(folderId)) {
            res.status(400).json({ message: 'Invalid folder ID.' });
            return;
        }
        if (typeof user?.id !== 'number') {
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return;
        }

        await deleteFolder(user.id, folderId);

        res.status(204).send(); // Send No Content on successful deletion
    } catch (error) {
        next(error); // Pass service errors to global handler
    }
});

export { router as folderRoutes };