import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources, visuals } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { AiStructuredContent } from '../../modules/ai/types/ai.types';
import { noteProcessingQueue } from './queue';
import { JobType, ProcessVisualPlaceholdersPayload, GenerateVisualPayload } from './job.definition';

// Access the type via AiStructuredContent
type VisualOpportunity = NonNullable<AiStructuredContent['visualOpportunities']>[number];

/**
 * Job processor for handling visual placeholders identified by AI.
 * - Fetches AI structure from source metadata.
 * - Creates visual records in the database.
 * - Enqueues GENERATE_VISUAL job for each.
 */
export async function processVisualPlaceholdersJob(job: Job<ProcessVisualPlaceholdersPayload>): Promise<void> {
  const { sourceId } = job.data;
  console.log(`[Worker:ProcessVisualPlaceholders] Starting job for source ID: ${sourceId}`);

  let sourceRecord;
  try {
    // 1. Fetch the source record, ensuring metadata includes aiStructure
    sourceRecord = await db.query.sources.findFirst({
      where: eq(sources.id, sourceId),
      columns: { metadata: true }, // Only need metadata
    });

    if (!sourceRecord || !sourceRecord.metadata || !(sourceRecord.metadata as any).aiStructure) {
      throw new Error(`Source record or AI structure in metadata not found for ID: ${sourceId}`);
    }

    const aiStructure = (sourceRecord.metadata as any).aiStructure as AiStructuredContent;
    const visualOpportunities: VisualOpportunity[] | null | undefined = aiStructure.visualOpportunities;

    if (!visualOpportunities || visualOpportunities.length === 0) {
      console.log(`[Worker:ProcessVisualPlaceholders] No visual opportunities found for source ID: ${sourceId}. Proceeding to assembly.`);
      // If no visuals, directly enqueue the final assembly job
      await db.update(sources)
        .set({ processingStage: 'ASSEMBLY_PENDING' })
        .where(eq(sources.id, sourceId));
      // Enqueue the next job
      await noteProcessingQueue.add(JobType.ASSEMBLE_NOTE, { sourceId }); 
      console.log(`[Worker:ProcessVisualPlaceholders] Enqueued ${JobType.ASSEMBLE_NOTE} job for source ID: ${sourceId}`);
      return; // Nothing more to do in this job
    }

    console.log(`[Worker:ProcessVisualPlaceholders] Found ${visualOpportunities.length} visual opportunities for source ID: ${sourceId}.`);

    // 2. Create visual records and enqueue GENERATE_VISUAL jobs
    const visualCreationPromises = visualOpportunities.map(async (opp) => {
      if (!opp.placeholderId || !opp.description) {
        console.warn(`[Worker:ProcessVisualPlaceholders] Skipping invalid visual opportunity for source ${sourceId}:`, opp);
        return null;
      }
      
      const newVisual = await db.insert(visuals).values({
        sourceId: sourceId,
        placeholderId: opp.placeholderId,
        description: opp.description,
        searchQuery: opp.searchQuery,
        status: 'PENDING',
      }).returning({ id: visuals.id });

      if (!newVisual || newVisual.length === 0) {
        console.error(`[Worker:ProcessVisualPlaceholders] Failed to create visual record for opportunity:`, opp);
        return null; // Don't enqueue if DB insert failed
      }

      const visualId = newVisual[0].id;
      const jobPayload: GenerateVisualPayload = { visualId, sourceId };
      await noteProcessingQueue.add(JobType.GENERATE_VISUAL, jobPayload);
      console.log(`[Worker:ProcessVisualPlaceholders] Enqueued ${JobType.GENERATE_VISUAL} job for visual ID: ${visualId} (Source: ${sourceId})`);
      return visualId;
    });

    const createdVisualIds = (await Promise.all(visualCreationPromises)).filter(id => id !== null);
    console.log(`[Worker:ProcessVisualPlaceholders] Successfully created ${createdVisualIds.length} visual records and enqueued jobs for source ID: ${sourceId}.`);

    // 3. Update source stage
    await db.update(sources)
      .set({ processingStage: 'GENERATING_VISUALS' })
      .where(eq(sources.id, sourceId));

    console.log(`[Worker:ProcessVisualPlaceholders] Successfully finished job for source ID: ${sourceId}`);

  } catch (error) {
    console.error(`[Worker:ProcessVisualPlaceholders] Error processing job for source ID: ${sourceId}`, error);
    // Update status to FAILED
    await db.update(sources)
      .set({ 
          processingStatus: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Error processing visual placeholders',
          processingStage: 'VISUAL_PROCESSING_PENDING' // Stage where it failed
       })
      .where(eq(sources.id, sourceId));
    throw error;
  }
} 