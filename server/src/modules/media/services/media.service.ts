import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { ProcessTextDto } from '../types/media.schemas';
import { noteProcessingQueue } from '@/core/jobs/queue';
import { JobType } from '@/core/jobs/job.definition';
import { eq } from 'drizzle-orm';
import { storageService } from '@/core/services/storage.service'; // Import StorageService
import * as fs from 'fs/promises'; // Import fs promises for deletion
import path from 'path'; // Import path for filename handling

// Define a basic user type expected from req.user (Passport)
interface AuthenticatedUser {
  id: number;
  // add other fields if needed
}

// Define the expected file object structure (e.g., from Multer)
interface UploadedFile {
  path: string; // Absolute path to the uploaded file
  originalname: string;
  mimetype: string;
  // add other fields if needed (e.g., size)
}

export class MediaService {

  async createSourceFromText(data: ProcessTextDto, user: AuthenticatedUser) {
    console.log(`[MediaService] Creating text source for user ${user.id}`);
    
    const newSource = await db.insert(sources).values({
      userId: user.id,
      sourceType: 'TEXT', // Set source type
      extractedText: data.text, // Store the provided text
      metadata: data.title ? { title: data.title } : {}, // Store optional title
      processingStatus: 'PENDING', // Initial status
      // processingStage will be set by the first job
    }).returning({
      id: sources.id,
      sourceType: sources.sourceType,
      processingStatus: sources.processingStatus,
    });

    if (!newSource || newSource.length === 0) {
      throw new Error('Failed to create source record'); // Use custom errors later
    }

    const createdSource = newSource[0];
    console.log(`[MediaService] Source record created with ID: ${createdSource.id}`);

    // Enqueue the job
    try {
      await noteProcessingQueue.add(JobType.PROCESS_SOURCE_TEXT, { sourceId: createdSource.id });
      console.log(`[MediaService] Enqueued ${JobType.PROCESS_SOURCE_TEXT} job for source ID: ${createdSource.id}`);
    } catch (queueError) {
        console.error(`[MediaService] Failed to enqueue job for source ID: ${createdSource.id}`, queueError);
        await db.update(sources)
          .set({ processingStatus: 'FAILED', processingError: 'Failed to enqueue processing job' })
          .where(eq(sources.id, createdSource.id)); 
    }

    return { 
        sourceId: createdSource.id,
        message: "Text source received, processing initiated." 
    };
  }

  /**
   * Handles processing of an uploaded audio file.
   * Uploads to Supabase, creates source record, and queues transcription job.
   * @param file The uploaded file object (containing path, originalname, mimetype).
   * @param user The authenticated user.
   * @param languageCode Optional language code for transcription.
   * @returns The result containing the new source ID.
   */
  async createSourceFromAudioUpload(file: UploadedFile, user: AuthenticatedUser, languageCode?: string) {
    console.log(`[MediaService] Processing audio upload for user ${user.id}: ${file.originalname}`);
    let storagePath: string | null = null;

    try {
      // 1. Construct storage path (e.g., user_123/audio/timestamp_filename.mp3)
      const timestamp = Date.now();
      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
      storagePath = `user_${user.id}/audio/${timestamp}_${safeFilename}`;

      // 2. Upload to Supabase Storage
      const uploadedPath = await storageService.uploadFile(
        file.path, // Local temporary path from multer
        storagePath,
        file.mimetype
      );

      if (!uploadedPath) {
        throw new Error('Storage service failed to return a path after upload.');
      }
      
      console.log(`[MediaService] Successfully uploaded to Supabase: ${storagePath}`);

       // 3. Delete local temporary file AFTER successful upload
       try {
         await fs.unlink(file.path);
         console.log(`[MediaService] Deleted local temp file: ${file.path}`);
       } catch (unlinkError) {
         // Log deletion error but don't fail the whole process
         console.error(`[MediaService] Failed to delete local temp file ${file.path}:`, unlinkError);
       }

      // 4. Create source record in DB
      const newSource = await db.insert(sources).values({
        userId: user.id,
        sourceType: 'AUDIO',
        originalFilename: file.originalname,
        originalStoragePath: storagePath, // Save the Supabase path
        metadata: { ...(languageCode && { languageCode }), storagePath }, // Include storagePath in metadata
        processingStatus: 'PENDING',
      }).returning({
        id: sources.id,
      });

      if (!newSource || newSource.length === 0) {
        throw new Error('Failed to create source record after upload');
      }
      const createdSource = newSource[0];
      console.log(`[MediaService] Source record created for audio upload with ID: ${createdSource.id}`);

      // 5. Enqueue the transcription job
      await noteProcessingQueue.add(JobType.PROCESS_AUDIO_TRANSCRIPTION, { 
          sourceId: createdSource.id, 
          audioFilePath: storagePath, // Pass Supabase path to job? Or let job fetch it?
          // For now, let's assume the job needs the storage path to fetch the file later.
          languageCode: languageCode 
      });
      console.log(`[MediaService] Enqueued ${JobType.PROCESS_AUDIO_TRANSCRIPTION} job for source ID: ${createdSource.id}`);

      return {
        sourceId: createdSource.id,
        message: "Audio file uploaded successfully, transcription initiated."
      };

    } catch (error) {
      console.error(`[MediaService] Error processing audio upload for user ${user.id}:`, error);
      
      // Cleanup attempt: If upload succeeded but DB/queue failed, try deleting from Supabase
      if (storagePath) {
          console.warn(`[MediaService] Attempting to clean up Supabase file due to error: ${storagePath}`);
          await storageService.deleteFile(storagePath); 
      }
      // Also ensure local file is deleted if it wasn't already
      try {
         // Simply attempt to delete the file
         await fs.unlink(file.path);
         console.log(`[MediaService] Deleted local temp file during error cleanup: ${file.path}`);
      } catch (cleanupError: any) {
         // Ignore ENOENT errors (file already deleted or never existed), log others
         if (cleanupError.code !== 'ENOENT') { 
            console.error(`[MediaService] Error during local file cleanup after error:`, cleanupError);
         }
      }

      // Re-throw a user-friendly error or handle specific errors
      throw new Error(`Failed to process audio upload: ${(error as Error).message}`);
    }
  }

}

export const mediaService = new MediaService();