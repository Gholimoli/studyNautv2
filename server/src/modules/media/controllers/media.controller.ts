import { Request, Response, NextFunction } from 'express';
import { mediaService } from '../services/media.service';
import { ProcessTextDtoSchema, ProcessPdfUrlDtoSchema } from '../types/media.schemas';
import fs from 'fs/promises';

// Define the structure for AuthenticatedUser if not already shared
interface AuthenticatedUser {
  id: number;
}

export class MediaController {

  async processText(req: Request, res: Response, next: NextFunction) {
    try {
      // Ensure user is authenticated (req.user should be populated by Passport)
      if (!req.user || !(req.user as any).id) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const authenticatedUser = req.user as { id: number };

      // Validate request body
      const validatedData = ProcessTextDtoSchema.parse(req.body);
      
      // Call service
      const result = await mediaService.createSourceFromText(validatedData, authenticatedUser);
      
      // Send response (Created)
      res.status(201).json(result);

    } catch (error) {
      // Basic error handling 
      console.error('[MediaController ProcessText Error]:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message }); 
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
      // next(error); 
    }
  }

  /**
   * Handles generic file upload requests (Audio or PDF).
   * Relies on the service layer to differentiate based on mimetype.
   */
  async handleFileUpload(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Check authentication
      if (!req.user || !(req.user as AuthenticatedUser).id) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const authenticatedUser = req.user as AuthenticatedUser;

      // 2. Check if file was uploaded (Multer adds file/files to req)
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
      }
      
      // 3. Extract optional language code (primarily for audio)
      const languageCode = req.query.languageCode as string | undefined;

      // 4. Call the generic service method - Corrected service method name
      // The service will determine if it's Audio or PDF based on req.file.mimetype
      const result = await mediaService.createSourceFromFileUpload(
        req.file, 
        authenticatedUser, 
        languageCode // Pass language code, service uses it mainly for audio
      );

      // 5. Send response (Created)
      res.status(201).json(result);

    } catch (error) {
      console.error('[MediaController handleFileUpload Error]:', error);
      // Ensure local temp file (if it still exists from multer) is cleaned up on error
      if (req.file?.path) {
        try {
            await fs.unlink(req.file.path);
            console.log(`[MediaController] Cleaned up multer temp file on error: ${req.file.path}`);
        } catch (cleanupError: any) {
            if (cleanupError.code !== 'ENOENT') { // Ignore if already deleted
                console.error(`[MediaController] Error cleaning up multer temp file on error:`, cleanupError);
            }
        }
      }
      
      if (error instanceof Error) {
          // Customize error response based on error type if needed
          res.status(400).json({ message: error.message || 'Failed to process file upload.' });
      } else {
          res.status(500).json({ message: 'Internal Server Error during file upload.' });
      }
    }
  }

  /**
   * Handles PDF URL submission requests.
   */
  async processPdfUrl(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Check authentication
      if (!req.user || !(req.user as AuthenticatedUser).id) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const authenticatedUser = req.user as AuthenticatedUser;

      // 2. Validate request body for URL
      const validatedData = ProcessPdfUrlDtoSchema.parse(req.body);

      // 3. Call the service method
      const result = await mediaService.createSourceFromPdfUrl(
        validatedData, 
        authenticatedUser
      );

      // 4. Send response (Created)
      res.status(201).json(result);

    } catch (error) {
      console.error('[MediaController ProcessPdfUrl Error]:', error);
      if (error instanceof Error) {
        // Check for Zod validation errors specifically if needed
        if ((error as any).errors) { // Basic check for ZodError structure
             res.status(400).json({ message: 'Invalid request body.', details: (error as any).errors });
        } else {
             res.status(400).json({ message: error.message || 'Failed to process PDF URL.' });
        }
      } else {
        res.status(500).json({ message: 'Internal Server Error during PDF URL processing.' });
      }
    }
  }

  // Add controllers for YouTube, other uploads later
}

export const mediaController = new MediaController(); 