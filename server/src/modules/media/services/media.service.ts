import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { ProcessTextDto } from '../types/media.schemas';
import { noteProcessingQueue } from '@/core/jobs/queue';
import { JobType } from '@/core/jobs/job.definition';
import { eq } from 'drizzle-orm';

// Define a basic user type expected from req.user (Passport)
interface AuthenticatedUser {
  id: number;
  // add other fields if needed
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
        // Decide how to handle enqueue failure - maybe mark source as failed?
        // For now, we'll still return success to the user, but log the error.
        await db.update(sources)
          .set({ processingStatus: 'FAILED', processingError: 'Failed to enqueue processing job' })
          .where(eq(sources.id, createdSource.id)); // Need eq from drizzle-orm
         // Re-throwing might be better in some cases, but could lead to complex frontend handling
    }

    return { 
        sourceId: createdSource.id,
        message: "Text source received, processing initiated." 
    };
  }

  // Add methods for YouTube, upload etc. later
}

export const mediaService = new MediaService(); 