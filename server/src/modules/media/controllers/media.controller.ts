import { Request, Response, NextFunction } from 'express';
import { mediaService } from '../services/media.service';
import { processTextSchema } from '../types/media.schemas';

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

  // Add controllers for YouTube, upload later
}

export const mediaController = new MediaController(); 