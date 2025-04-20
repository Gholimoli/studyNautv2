import { Job } from 'bullmq';
import { db } from '../db';
import { sources, visuals, notes } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../logger/logger';
import {
  AiStructuredContent,
  LessonBlock,
  aiStructuredContentSchema,
} from '../../modules/ai/types/ai.types';
import { noteProcessingQueue } from './queue';
import { JobType } from './job.definition';
// Define a simple payload for this job
interface ProcessVisualPlaceholdersPayload {
  sourceId: number;
}

// Helper function to recursively find visual placeholders
function findVisualPlaceholders(blocks: LessonBlock[]): LessonBlock[] {
  const placeholders: LessonBlock[] = [];
  if (!Array.isArray(blocks)) {
    return placeholders;
  }

  blocks.forEach((block) => {
    // Relaxed check: Only require contentType and placeholderId
    if (block.contentType === 'visual_placeholder' && block.placeholderId) {
      placeholders.push(block);
    }
    if (block.subStructure) {
      placeholders.push(...findVisualPlaceholders(block.subStructure));
    }
  });

  return placeholders;
}


export async function handleProcessVisualPlaceholdersJob(
  job: Job<ProcessVisualPlaceholdersPayload>,
): Promise<void> {
  const { sourceId } = job.data;
  logger.info(
    { sourceId },
    `Starting PROCESS_VISUAL_PLACEHOLDERS job for source ID: ${sourceId}`,
  );

  try {
    // 1. Fetch the source record to get the lesson structure from metadata
    const sourceRecord = await db.query.sources.findFirst({
      where: eq(sources.id, sourceId),
      columns: { metadata: true }, // Only fetch metadata
    });

    if (!sourceRecord || !sourceRecord.metadata) {
      throw new Error(`Source record or metadata not found for ID: ${sourceId}`);
    }

    // 2. Parse the AI structure from metadata
    const metadata = sourceRecord.metadata as { lessonStructureJson?: AiStructuredContent };
    const aiStructure = metadata.lessonStructureJson;

    // Log the raw structure BEFORE parsing or finding placeholders
    logger.info({ sourceId, structure: JSON.stringify(aiStructure, null, 2) }, 'Raw AI structure received before parsing/finding placeholders:');

    if (!aiStructure) {
      throw new Error(
        `lessonStructureJson not found in metadata for source ID: ${sourceId}`,
      );
    }
    
    // Validate the structure (optional but recommended)
    try {
      aiStructuredContentSchema.parse(aiStructure);
    } catch (parseError) {
        logger.error({ sourceId, parseError }, 'Invalid AI structure format in metadata');
        throw new Error(`Invalid AI structure format for source ${sourceId}.`);
    }

    // 3. Find all visual placeholders within the structure
    const visualPlaceholders = findVisualPlaceholders(aiStructure.structure);
    const visualOpportunitiesMap = new Map(
        (aiStructure.visualOpportunities ?? []).map(vo => [vo.placeholderId, vo])
    );

    if (visualPlaceholders.length === 0) {
      logger.info({ sourceId }, 'No visual placeholders found in the structure.');
      // If no visuals, the process effectively skips to assembly.
      // Set the stage appropriately so the check logic works if needed elsewhere,
      // but DO NOT enqueue ASSEMBLE_NOTE here.
      // The check in generateVisualJob handles the case where it's the last one.
      // If this was the *only* step, a different trigger mechanism would be needed,
      // but for now, assume visual generation pipeline handles it.
      // We could potentially enqueue ASSEMBLE_NOTE directly *only* if we are *certain*
      // no GENERATE_VISUAL jobs will ever run for this source.
      // Let's update the stage to prevent potential issues if generateVisualJob runs unexpectedly.
      await db.update(sources)
          .set({ processingStage: 'ASSEMBLY_PENDING' }) // Directly mark ready for assembly
          .where(eq(sources.id, sourceId));
      logger.info({ sourceId }, 'No visuals found, marked source stage as ASSEMBLY_PENDING.');
      // TODO: Decide if a direct enqueue of ASSEMBLE_NOTE is safe/needed here.
      // For now, removing it to rely on the check in generateVisualJob
      // await noteProcessingQueue.add(JobType.ASSEMBLE_NOTE, { sourceId }); 
      // logger.info({ sourceId }, 'Enqueued ASSEMBLE_NOTE job as no visuals needed processing.'); 
      return; // Job done
    }

    logger.info(
      { sourceId, count: visualPlaceholders.length },
      `Found ${visualPlaceholders.length} visual placeholders. Creating records and enqueueing GENERATE_VISUAL jobs.`,
    );

    // 4. Create visual records in DB and enqueue jobs
    const visualJobs = visualPlaceholders.map(async (placeholder) => {
      if (!placeholder.placeholderId) {
         // This check might be redundant now due to findVisualPlaceholders, but good practice
        logger.warn({ sourceId, placeholder }, 'Skipping visual placeholder due to missing placeholderId.');
        return null;
      }

      // Fetch details from the visualOpportunities array using the placeholderId
      const opportunity = visualOpportunitiesMap.get(placeholder.placeholderId);

      if (!opportunity || !opportunity.description || !opportunity.concept || !opportunity.searchQuery) {
        logger.warn({ sourceId, placeholderId: placeholder.placeholderId }, 'Skipping placeholder as corresponding opportunity details (description, concept, query) are missing.');
        return null; // Skip this placeholder
      }

      // Create Visual DB Record using data from visualOpportunities
      const newVisualResult = await db.insert(visuals).values({
          sourceId: sourceId,
          placeholderId: placeholder.placeholderId,
          concept: opportunity.concept, // Use from opportunity
          description: opportunity.description, // Use from opportunity
          searchQuery: opportunity.searchQuery, // Use from opportunity
          status: 'PENDING_GENERATION', // Set initial status
      }).returning({ id: visuals.id });

      const visualId = newVisualResult[0]?.id;

      if (!visualId) {
        logger.error({ sourceId, placeholderId: placeholder.placeholderId }, 'Failed to insert visual record into DB.');
        return null; // Skip enqueueing if DB insert failed
      }

      // Enqueue GENERATE_VISUAL job using data from visualOpportunities
      await noteProcessingQueue.add(JobType.GENERATE_VISUAL, {
        sourceId: sourceId, // Pass sourceId for context
        visualId: visualId,
        placeholderId: placeholder.placeholderId,
        description: opportunity.description, // Use from opportunity
        searchQuery: opportunity.searchQuery, // Use from opportunity
      });

      logger.info({ sourceId, visualId, placeholderId: placeholder.placeholderId }, `Enqueued GENERATE_VISUAL job.`)
      return { visualId, placeholderId: placeholder.placeholderId };
    });

    const results = await Promise.all(visualJobs);
    const successfulJobs = results.filter(r => r !== null);

    // Update source stage to indicate visual generation is in progress
    if (successfulJobs.length > 0) {
      await db.update(sources)
        .set({ processingStage: 'GENERATING_VISUALS' }) // Set specific stage
        .where(eq(sources.id, sourceId));
        logger.info({ sourceId }, 'Updated source stage to GENERATING_VISUALS.');
    } // If no successful jobs were enqueued, the existing direct ASSEMBLE_NOTE path handles it.

    logger.info(
      { sourceId, successfulCount: successfulJobs.length, totalPlaceholders: visualPlaceholders.length },
      `Finished enqueueing ${successfulJobs.length} GENERATE_VISUAL jobs for source ID: ${sourceId}.`,
    );

    // TODO: Remove any leftover explicit ASSEMBLE_NOTE enqueueing from here (except the 'no visuals found' case)

  } catch (error: any) {
    logger.error(
      { sourceId, error: error.message, stack: error.stack },
      `Error processing PROCESS_VISUAL_PLACEHOLDERS job for source ID: ${sourceId}`,
    );
    // TODO: Update source status to FAILED
    // await db.update(sources).set({ processingStatus: 'FAILED', processingError: error.message }).where(eq(sources.id, sourceId));
    throw error; // Re-throw to mark job as failed in BullMQ
  }
} 