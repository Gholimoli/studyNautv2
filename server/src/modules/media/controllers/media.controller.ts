import { Request, Response, NextFunction } from 'express';
import { mediaService } from '../services/media.service';
import { processTextSchema } from '../types/media.schemas';
import fs from 'fs';

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
      const validatedData = processTextSchema.parse(req.body);
      
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
   * Handles audio file upload requests.
   */
  async uploadAudio(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Check authentication
      if (!req.user || !(req.user as AuthenticatedUser).id) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const authenticatedUser = req.user as AuthenticatedUser;

      // 2. Check if file was uploaded (Multer adds file/files to req)
      if (!req.file) {
        return res.status(400).json({ message: 'No audio file uploaded.' });
      }
      
      // 3. Extract optional language code (example: from query param)
      const languageCode = req.query.languageCode as string | undefined;

      // 4. Call the service method
      // req.file contains path, originalname, mimetype from Multer
      const result = await mediaService.createSourceFromAudioUpload(
        req.file, 
        authenticatedUser, 
        languageCode
      );

      // 5. Send response (Created)
      res.status(201).json(result);

    } catch (error) {
      console.error('[MediaController UploadAudio Error]:', error);
       // Ensure local temp file (if it still exists from multer) is cleaned up on error
      if (req.file?.path) {
          try {
              await fs.promises.unlink(req.file.path);
              console.log(`[MediaController] Cleaned up multer temp file on error: ${req.file.path}`);
          } catch (cleanupError: any) {
              if (cleanupError.code !== 'ENOENT') { // Ignore if already deleted
                  console.error(`[MediaController] Error cleaning up multer temp file on error:`, cleanupError);
              }
          }
      }
      
      if (error instanceof Error) {
          // Customize error response based on error type if needed
          res.status(400).json({ message: error.message || 'Failed to process audio upload.' });
      } else {
          res.status(500).json({ message: 'Internal Server Error during audio upload.' });
      }
       // next(error); // Or use global error handler
    }
  }

  // Add controllers for YouTube, other uploads later
}

export const mediaController = new MediaController(); 