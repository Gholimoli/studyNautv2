import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources, visuals } from '../db/schema';
import { eq, sql, and, or, not } from 'drizzle-orm';
import { GenerateVisualPayload, JobType, AssembleNotePayload } from './job.definition';
import { searchImage } from '../../modules/ai/utils/image-search';
import { noteProcessingQueue } from './queue';
// import { searchImage } from '@/modules/ai/utils/image-search'; // TODO: Import later
// import { JobType, AssembleNotePayload } from './job.definition'; // TODO: Import later
// import { noteProcessingQueue } from './queue'; // TODO: Import later

/**
 * Job processor for generating or finding a visual for a placeholder.
 * - Fetches visual details (description, query).
 * - Calls image search/generation utility.
 * - Updates visual record with URL or error.
 * - Checks if all visuals for the source are done to enqueue assembly.
 */
export async function generateVisualJob(job: Job<GenerateVisualPayload>): Promise<void> {
  const { visualId, sourceId } = job.data;
  console.log(`[Worker:GenerateVisual] Starting job for visual ID: ${visualId} (Source: ${sourceId})`);

  let visualRecord;
  try {
    // 1. Update visual status to PROCESSING
    await db.update(visuals)
      .set({ status: 'PROCESSING' })
      .where(eq(visuals.id, visualId));

    // 2. Fetch visual record
    visualRecord = await db.query.visuals.findFirst({
      where: eq(visuals.id, visualId),
    });

    if (!visualRecord) {
      throw new Error(`Visual record not found for ID: ${visualId}`);
    }
    if (!visualRecord.description) {
        throw new Error(`Visual record ID ${visualId} missing description.`);
    }

    // 3. Call Image Search Utility
    const searchQuery = visualRecord.searchQuery || visualRecord.description;
    console.log(`[Worker:GenerateVisual] Searching for image for visual ID: ${visualId} with query: "${searchQuery.substring(0, 50)}..."`);
    const imageUrl = await searchImage(searchQuery);

    if (!imageUrl) {
        // Handle search/generation failure
        console.warn(`[Worker:GenerateVisual] Image search failed for visual ID: ${visualId}`);
        await db.update(visuals)
          .set({ status: 'FAILED', errorMessage: 'Image search failed' })
          .where(eq(visuals.id, visualId));
        // Do not re-throw, allow other visuals to process. Failure is recorded.
    } else {
        // 4. Update visual record with URL and mark COMPLETED
        await db.update(visuals)
        .set({ status: 'COMPLETED', imageUrl: imageUrl })
        .where(eq(visuals.id, visualId));
        console.log(`[Worker:GenerateVisual] Successfully processed visual ID: ${visualId}.`);
    }

    // 5. Check if all visuals for this sourceId are done (COMPLETED or FAILED)
    // Need to use a raw query or count for this check
    const pendingOrProcessing = await db.select({ count: sql<number>`count(*)::int` })
        .from(visuals)
        .where(and(
            eq(visuals.sourceId, sourceId),
            or(eq(visuals.status, 'PENDING'), eq(visuals.status, 'PROCESSING'))
        ));

    const remainingCount = pendingOrProcessing[0]?.count ?? 1; // Assume 1 if query fails, to be safe
    
    console.log(`[Worker:GenerateVisual] Checking completion for source ${sourceId}. Remaining visuals: ${remainingCount}`);

    if (remainingCount === 0) {
        console.log(`[Worker:GenerateVisual] All visuals processed for source ID: ${sourceId}. Enqueuing assembly.`);
        const assemblyPayload: AssembleNotePayload = { sourceId };
        await noteProcessingQueue.add(JobType.ASSEMBLE_NOTE, assemblyPayload);
        // Update source stage
        await db.update(sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where(eq(sources.id, sourceId));
    }

    console.log(`[Worker:GenerateVisual] Finished job for visual ID: ${visualId}`);

  } catch (error) {
    console.error(`[Worker:GenerateVisual] Error processing job for visual ID: ${visualId}`, error);
    // Update visual status to FAILED if an unexpected error occurred
    if (visualId) { // Ensure visualId is defined before trying to update
        await db.update(visuals)
        .set({ 
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error during visual generation'
        })
        .where(eq(visuals.id, visualId));
        
        // After failure, still check if this was the *last* pending one
        try {
            const pendingOrProcessing = await db.select({ count: sql<number>`count(*)::int` })
                .from(visuals)
                .where(and(
                    eq(visuals.sourceId, sourceId),
                    or(eq(visuals.status, 'PENDING'), eq(visuals.status, 'PROCESSING'))
                ));
            const remainingCount = pendingOrProcessing[0]?.count ?? 1; 
            if (remainingCount === 0) {
                console.log(`[Worker:GenerateVisual] All visuals processed (including failures) for source ID: ${sourceId}. Enqueuing assembly.`);
                const assemblyPayload: AssembleNotePayload = { sourceId };
                await noteProcessingQueue.add(JobType.ASSEMBLE_NOTE, assemblyPayload);
                await db.update(sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where(eq(sources.id, sourceId));
            }
        } catch (checkError) {
            console.error(`[Worker:GenerateVisual] Error checking completion status after failure for source ${sourceId}`, checkError);
        }
    }
    // Do not re-throw error here to allow other visuals to process
  }
} 