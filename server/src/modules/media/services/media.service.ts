import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { ProcessTextDto, ProcessPdfUrlDto } from '../types/media.schemas';
import { noteProcessingQueue } from '@/core/jobs/queue';
import { JobType, JobName } from '@/core/jobs/job.definition';
import { eq } from 'drizzle-orm';
import { storageService } from '@/core/services/storage.service'; // Import StorageService
import * as fs from 'fs/promises'; // Import fs promises for deletion
import path from 'path'; // Import path for filename handling
import { francAll } from 'franc-all'; // Import language detection library
import { z } from 'zod'; // Added Zod for URL validation
// import { iso6393To1 } from '@/lib/utils/language-codes'; // No longer needed for mapping

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
    
    // Detect language (ISO 639-3)
    const langGuesses = francAll(data.text.substring(0, 1000), { minLength: 3 });
    const detectedLang3 = langGuesses.length > 0 ? langGuesses[0][0] : 'und'; // Get the top guess (ISO 639-3) or 'und'
    // Use 'eng' as the effective default if undetermined for processing consistency
    const finalLanguageCode = detectedLang3 === 'und' ? 'eng' : detectedLang3; 
    console.log(`[MediaService] Detected language (Top Guess ISO 639-3): ${detectedLang3}, Using for processing: ${finalLanguageCode}`);

    // Prepare metadata (optional title)
    const metadata: Record<string, any> = {};
    if (data.title) {
      metadata.title = data.title;
    }

    const newSource = await db.insert(sources).values({
      userId: user.id,
      sourceType: 'TEXT',
      extractedText: data.text,
      languageCode: finalLanguageCode, // Save to dedicated column
      metadata: metadata, // Save only other metadata (like title)
      processingStatus: 'PENDING',
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
   * Handles processing of an uploaded file (Audio or PDF).
   * Uploads to storage, creates source record, and queues the appropriate processing job.
   * @param file The uploaded file object.
   * @param user The authenticated user.
   * @param languageCode Optional language code (primarily for audio transcription).
   * @returns The result containing the new source ID.
   */
  async createSourceFromFileUpload(file: UploadedFile, user: AuthenticatedUser, languageCode?: string) {
    console.log(`[MediaService] Processing file upload for user ${user.id}: ${file.originalname}, Type: ${file.mimetype}. Provided language code: ${languageCode || 'None'}`);
    let storagePath: string | null = null;
    let sourceType: 'AUDIO' | 'PDF' | 'IMAGE'; // Determine source type
    let jobToEnqueue: JobName;
    let jobPayload: { sourceId: number, [key: string]: any } = { sourceId: 0 }; // Initialize with placeholder

    // Determine source type and job based on mimetype
    if (file.mimetype.startsWith('audio/')) {
      sourceType = 'AUDIO';
      jobToEnqueue = JobType.PROCESS_AUDIO_TRANSCRIPTION;
    } else if (file.mimetype === 'application/pdf') {
      sourceType = 'PDF';
      jobToEnqueue = JobType.PROCESS_PDF; 
    } else if (file.mimetype.startsWith('image/')) {
      sourceType = 'IMAGE';
      jobToEnqueue = JobType.PROCESS_IMAGE; 
    } else {
      // Now only rejects truly unsupported types
      await fs.unlink(file.path); // Clean up temp file
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    // Use provided language code or default to 'eng' (ISO 639-3) - Primarily for Audio
    // PDF language detection happens in its dedicated job
    const finalLanguageCode = languageCode || 'eng'; 

    try {
      // 1. Construct storage path (e.g., user_123/{audio|pdf|image}/timestamp_filename.ext)
      const timestamp = Date.now();
      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
      let folder = 'unknown';
      if (sourceType === 'AUDIO') folder = 'audio';
      else if (sourceType === 'PDF') folder = 'pdf';
      else if (sourceType === 'IMAGE') folder = 'images';

      storagePath = `user_${user.id}/${folder}/${timestamp}_${safeFilename}`;

      // 2. Upload to Supabase Storage
      console.log(`[MediaService] Uploading ${sourceType} to Supabase: ${storagePath}`);
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
        console.error(`[MediaService] Failed to delete local temp file ${file.path}:`, unlinkError);
      }

      // 4. Create source record in DB
      const newSourceData: typeof sources.$inferInsert = {
        userId: user.id,
        sourceType: sourceType,
        originalFilename: file.originalname,
        originalStoragePath: storagePath,
        processingStatus: 'PENDING',
        metadata: { storagePath }, // Keep storagePath in metadata for now
      };

      // Add language code only if it's relevant initially (i.e., for Audio)
      if (sourceType === 'AUDIO') {
          newSourceData.languageCode = finalLanguageCode;
      } // PDF & Image language is determined later (or irrelevant for image)

      const newSource = await db.insert(sources).values(newSourceData).returning({ id: sources.id });

      if (!newSource || newSource.length === 0) {
        throw new Error('Failed to create source record after upload');
      }
      const createdSource = newSource[0];
      jobPayload.sourceId = createdSource.id; // Set the actual source ID
      console.log(`[MediaService] Source record created for ${sourceType} upload with ID: ${createdSource.id}`);

      // Add language code to payload if it's an audio job
      if (jobToEnqueue === JobType.PROCESS_AUDIO_TRANSCRIPTION) {
          jobPayload.languageCode = finalLanguageCode;
      }

      // 5. Enqueue the appropriate job
      await noteProcessingQueue.add(jobToEnqueue, jobPayload);
      console.log(`[MediaService] Enqueued ${jobToEnqueue} job for source ID: ${createdSource.id}${sourceType === 'AUDIO' ? ', Language: ' + finalLanguageCode : ''}`);

      return {
        sourceId: createdSource.id,
        message: `${sourceType} file uploaded successfully, processing initiated.`
      };

    } catch (error) {
      console.error(`[MediaService] Error processing ${sourceType || 'file'} upload for user ${user.id}:`, error);
      
      // Cleanup attempt: Delete storage file and local temp file
      if (storagePath) {
          console.warn(`[MediaService] Attempting to clean up Supabase file due to error: ${storagePath}`);
          try { await storageService.deleteFile(storagePath); } catch (e) { console.error('[MediaService] Error cleaning storage file:', e);}
      }
      try {
         await fs.unlink(file.path);
         console.log(`[MediaService] Deleted local temp file during error cleanup: ${file.path}`);
      } catch (cleanupError: any) {
         if (cleanupError.code !== 'ENOENT') { 
            console.error(`[MediaService] Error during local file cleanup after error:`, cleanupError);
         }
      }

      throw new Error(`Failed to process ${sourceType || 'file'} upload: ${(error as Error).message}`);
    }
  }

  /**
   * Creates a Source record for a PDF from a URL and queues it for processing.
   * @param data Object containing the PDF URL.
   * @param user The authenticated user.
   * @returns The result containing the new source ID.
   */
  async createSourceFromPdfUrl(data: ProcessPdfUrlDto, user: AuthenticatedUser) {
    console.log(`[MediaService] Processing PDF URL for user ${user.id}: ${data.url}`);

    // Basic URL validation (can be enhanced)
    try {
        z.string().url().parse(data.url); 
    } catch (validationError) {
        throw new Error('Invalid URL provided.');
    }

    // Create source record
    const newSource = await db.insert(sources).values({
      userId: user.id,
      sourceType: 'PDF',
      originalUrl: data.url, // Store the URL
      processingStatus: 'PENDING',
      metadata: { originalUrl: data.url }, // Include URL in metadata too for consistency
    }).returning({
      id: sources.id,
    });

    if (!newSource || newSource.length === 0) {
      throw new Error('Failed to create source record for PDF URL');
    }
    const createdSource = newSource[0];
    console.log(`[MediaService] Source record created for PDF URL with ID: ${createdSource.id}`);

    // Enqueue the PDF processing job
    try {
      await noteProcessingQueue.add(JobType.PROCESS_PDF, { sourceId: createdSource.id });
      console.log(`[MediaService] Enqueued ${JobType.PROCESS_PDF} job for source ID: ${createdSource.id}`);
    } catch (queueError) {
        console.error(`[MediaService] Failed to enqueue PDF processing job for source ID: ${createdSource.id}`, queueError);
        await db.update(sources)
          .set({ processingStatus: 'FAILED', processingError: 'Failed to enqueue PDF processing job' })
          .where(eq(sources.id, createdSource.id)); 
        throw new Error('Failed to start PDF processing after saving source.');
    }

    return {
      sourceId: createdSource.id,
      message: "PDF URL received, processing initiated."
    };
  }

}

export const mediaService = new MediaService();