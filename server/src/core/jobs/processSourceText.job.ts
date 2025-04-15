import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources } from '../db/schema';
import { eq } from 'drizzle-orm';
import { aiService } from '../../modules/ai/ai.service';

// Import Job Types and Queue
import { JobType, ProcessVisualPlaceholdersPayload } from './job.definition';
import { noteProcessingQueue } from './queue';

interface ProcessSourceTextJobData {
  sourceId: number;
}

/**
 * Job processor for handling initial text processing.
 * - Fetches source text.
 * - (Later) Calls AI service to generate structure.
 * - Updates source status.
 */
export async function processSourceTextJob(job: Job<ProcessSourceTextJobData>): Promise<void> {
  const { sourceId } = job.data;
  console.log(`[Worker:ProcessSourceText] Starting job for source ID: ${sourceId}`);

  let sourceRecord;
  try {
    // 1. Update status to PROCESSING and set stage
    await db.update(sources)
      .set({ processingStatus: 'PROCESSING', processingStage: 'AI_ANALYSIS' })
      .where(eq(sources.id, sourceId));
    console.log(`[Worker:ProcessSourceText] Set status to PROCESSING for source ID: ${sourceId}`);

    // 2. Fetch the source record
    sourceRecord = await db.query.sources.findFirst({
      where: eq(sources.id, sourceId),
    });

    if (!sourceRecord || !sourceRecord.extractedText) {
      throw new Error(`Source record or extracted text not found for ID: ${sourceId}`);
    }

    // 3. Call AI Service to generate lesson structure
    console.log(`[Worker:ProcessSourceText] Calling AI service for source ID: ${sourceId}...`);
    const aiResult = await aiService.generateLessonStructure(sourceRecord.extractedText);

    if (!aiResult) {
        // Error already logged within AiService
        throw new Error(`AI service failed to generate structure for source ID: ${sourceId}`);
    }
    console.log(`[Worker:ProcessSourceText] AI analysis successful for source ID: ${sourceId}`);

    // 4. Update source record with AI result (store structured content in metadata)
    // Combine with existing metadata if any
    const updatedMetadata = { 
        ...(sourceRecord.metadata as object || {}), 
        aiStructure: aiResult // Contains title, summary, structure array
    };
    await db.update(sources)
      .set({ 
          metadata: updatedMetadata, 
          processingStage: 'VISUAL_PROCESSING_PENDING' // Set stage for next step
      })
      .where(eq(sources.id, sourceId));
    console.log(`[Worker:ProcessSourceText] Stored AI structure in metadata for source ID: ${sourceId}`);

    // 5. Enqueue PROCESS_VISUAL_PLACEHOLDERS job
    const nextJobPayload: ProcessVisualPlaceholdersPayload = { sourceId };
    await noteProcessingQueue.add(JobType.PROCESS_VISUAL_PLACEHOLDERS, nextJobPayload);
    console.log(`[Worker:ProcessSourceText] Enqueued ${JobType.PROCESS_VISUAL_PLACEHOLDERS} job for source ID: ${sourceId}`);

    console.log(`[Worker:ProcessSourceText] Successfully finished job for source ID: ${sourceId}`);

  } catch (error) {
    console.error(`[Worker:ProcessSourceText] Error processing job for source ID: ${sourceId}`, error);
    // Update status to FAILED
    await db.update(sources)
      .set({ 
          processingStatus: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Unknown processing error',
          processingStage: sourceRecord?.processingStage || 'AI_ANALYSIS' // Record stage where it failed
       })
      .where(eq(sources.id, sourceId));
    
    // Re-throw the error so BullMQ knows the job failed
    throw error;
  }
} 