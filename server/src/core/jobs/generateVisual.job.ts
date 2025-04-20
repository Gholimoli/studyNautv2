import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources, visuals } from '../db/schema';
import { eq, sql, and, or, not } from 'drizzle-orm';
import { GenerateVisualPayload, JobType, AssembleNotePayload } from './job.definition';
import { searchImages, ImageSearchResult } from '../../modules/ai/utils/image-search';
import { noteProcessingQueue } from './queue';
import * as stringSimilarity from 'string-similarity';
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
      columns: { description: true, searchQuery: true }, // Only fetch needed fields
    });

    if (!visualRecord) {
      throw new Error(`Visual record not found for ID: ${visualId}`);
    }
    // Use searchQuery first, fallback to description if null/empty
    const query = visualRecord.searchQuery?.trim() || visualRecord.description;
    if (!query) {
        throw new Error(`Visual record ID ${visualId} missing description and searchQuery.`);
    }

    // 3. Call Image Search Utility to get multiple results
    console.log(`[Worker:GenerateVisual] Searching for images for visual ID: ${visualId} with query: "${query.substring(0, 50)}..."`);
    let imageResults: ImageSearchResult[] | null = null;
    let searchError: Error | null = null;
    try {
      imageResults = await searchImages(query, 5); // Request top 5 images for better selection pool
    } catch (error) {
      searchError = error instanceof Error ? error : new Error('Unknown image search error');
      console.error(`[Worker:GenerateVisual] Image search failed for visual ID: ${visualId}`, searchError);
    }
    
    // Check for specific errors like account limits
    const isAccountLimitError = searchError?.message?.includes('Your account has run out of searches');

    if (searchError) {
        // Handle image search API error
        console.error(`[Worker:GenerateVisual] Image search API error for visual ID: ${visualId}: ${searchError.message}`);
        await db.update(visuals)
          .set({ 
              status: 'FAILED', 
              errorMessage: isAccountLimitError 
                  ? 'Image search failed: Account limit reached.' 
                  : `Image search API error: ${searchError.message.substring(0, 200)}` 
          })
          .where(eq(visuals.id, visualId));
    } else if (!imageResults || imageResults.length === 0) {
        // Handle no results found initially
        console.warn(`[Worker:GenerateVisual] No image results returned by search API for visual ID: ${visualId}`);
        await db.update(visuals)
          .set({ status: 'NO_IMAGE_FOUND', errorMessage: 'No suitable images found by search API' })
          .where(eq(visuals.id, visualId));
    } else {
        // 4. Select the best image using similarity scoring
        const selectedImage = findBestImageBySimilarity(imageResults, visualRecord.description || ''); 

        if (selectedImage) {
            // 5. Update visual record with selected image details and mark COMPLETED
            console.log(`[Worker:GenerateVisual] Updating DB for visual ID ${visualId} with selected image: ${selectedImage.imageUrl.substring(0, 80)}...`);
            
            // --- Improved Alt Text --- 
            // Prioritize the description provided by the AI for better context
            const finalAltText = visualRecord?.description?.trim() || selectedImage.altText;
            console.log(`[Worker:GenerateVisual] Using alt text: "${finalAltText.substring(0,80)}..."`);
            // -----------------------
            
            await db.update(visuals)
              .set({ 
                  status: 'COMPLETED', 
                  imageUrl: selectedImage.imageUrl,
                  altText: finalAltText, // Use the determined alt text
                  sourceUrl: selectedImage.sourceUrl,
                  sourceTitle: selectedImage.sourceTitle,
                  errorMessage: null // Clear any previous error message
                })
              .where(eq(visuals.id, visualId));
            console.log(`[Worker:GenerateVisual] Successfully processed visual ID: ${visualId}.`);
        } else {
             // Handle no image meeting similarity threshold
            console.warn(`[Worker:GenerateVisual] No image met similarity threshold for visual ID: ${visualId}`);
            await db.update(visuals)
              .set({ status: 'NO_IMAGE_FOUND', errorMessage: 'No sufficiently relevant images found' })
              .where(eq(visuals.id, visualId));
        }
    }

    // 6. Check if all visuals for this sourceId are done (COMPLETED, FAILED, or NO_IMAGE_FOUND)
    // Need to use a raw query or count for this check
    const pendingOrProcessing = await db.select({ count: sql<number>`count(*)::int` })
        .from(visuals)
        .where(and(
            eq(visuals.sourceId, sourceId),
            // Check for statuses that mean processing is NOT finished
            or(eq(visuals.status, 'PENDING'), eq(visuals.status, 'PENDING_GENERATION'), eq(visuals.status, 'PROCESSING')) 
        ));

    const remainingCount = pendingOrProcessing[0]?.count ?? 1; // Assume 1 if query fails, to be safe
    
    console.log(`[Worker:GenerateVisual] Checking completion for source ${sourceId}. Remaining visuals needing processing: ${remainingCount}`);

    if (remainingCount === 0) {
        // Check if the source itself is still in the right stage
        const currentSource = await db.query.sources.findFirst({
            where: eq(sources.id, sourceId),
            columns: { processingStage: true }
        });

        if (currentSource?.processingStage === 'GENERATING_VISUALS') {
            console.log(`[Worker:GenerateVisual] All visuals processed for source ID: ${sourceId}. Enqueuing assembly.`);
            const assemblyPayload: AssembleNotePayload = { sourceId };
            await noteProcessingQueue.add(JobType.ASSEMBLE_NOTE, assemblyPayload);
            // Update source stage
            await db.update(sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where(eq(sources.id, sourceId));
        } else {
            console.log(`[Worker:GenerateVisual] All visuals processed for source ${sourceId}, but source stage is already '${currentSource?.processingStage}'. Assembly job likely already enqueued.`);
        }
    }

    console.log(`[Worker:GenerateVisual] Finished job for visual ID: ${visualId}`);

  } catch (error) {
    console.error(`[Worker:GenerateVisual] FATAL Error processing job for visual ID: ${visualId}`, error);
    // Update visual status to FAILED if an unexpected error occurred
    if (visualId) { // Ensure visualId is defined before trying to update
        try {
            await db.update(visuals)
            .set({ 
                status: 'FAILED',
                errorMessage: error instanceof Error ? error.message : 'Unknown error during visual generation'
            })
            .where(eq(visuals.id, visualId));
        } catch (dbError) {
            console.error(`[Worker:GenerateVisual] Failed to update visual status to FAILED for visual ${visualId} after main error:`, dbError);
        }
        
        // After failure, still check if this was the *last* pending one to enqueue assembly
        try {
            const pendingOrProcessing = await db.select({ count: sql<number>`count(*)::int` })
                .from(visuals)
                .where(and(
                    eq(visuals.sourceId, sourceId),
                    or(eq(visuals.status, 'PENDING'), eq(visuals.status, 'PENDING_GENERATION'), eq(visuals.status, 'PROCESSING')) 
                ));
            const remainingCount = pendingOrProcessing[0]?.count ?? 1; 
            if (remainingCount === 0) {
                 const currentSource = await db.query.sources.findFirst({
                    where: eq(sources.id, sourceId),
                    columns: { processingStage: true }
                });
                if (currentSource?.processingStage === 'GENERATING_VISUALS') {
                    console.log(`[Worker:GenerateVisual] All visuals processed (including fatal error on ${visualId}) for source ID: ${sourceId}. Enqueuing assembly.`);
                    const assemblyPayload: AssembleNotePayload = { sourceId };
                    await noteProcessingQueue.add(JobType.ASSEMBLE_NOTE, assemblyPayload);
                    await db.update(sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where(eq(sources.id, sourceId));
                } else {
                     console.log(`[Worker:GenerateVisual] All visuals processed for source ${sourceId} (including fatal error on ${visualId}), but source stage is already '${currentSource?.processingStage}'. Assembly job likely already enqueued.`);
                }
            }
        } catch (checkError) {
            console.error(`[Worker:GenerateVisual] Error checking completion status after failure for source ${sourceId}`, checkError);
        }
    }
    // Do not re-throw error here to allow other visuals to process, but log it as FATAL
  }
}

// --- Helper function to find the best image based on similarity ---
function findBestImageBySimilarity(
    results: ImageSearchResult[], 
    targetDescription: string,
    similarityThreshold: number = 0.15 // Configurable threshold (0 to 1) - Lowered default
): ImageSearchResult | null {
    if (!results || results.length === 0 || !targetDescription) {
        return null;
    }

    console.log(`[Worker:GenerateVisual] Scoring ${results.length} image results against description: "${targetDescription.substring(0,50)}..."`);

    const scoredResults = results.map(result => {
        // Compare target description against the image title (most reliable field)
        const similarity = stringSimilarity.compareTwoStrings(
            targetDescription.toLowerCase(), 
            result.altText.toLowerCase() // Use altText (which is image title)
        );
        // Add a small bonus for having source info, penalize slightly if missing
        const attributionBonus = (result.sourceUrl && result.sourceTitle) ? 0.05 : -0.02;
        const finalScore = similarity + attributionBonus;

        console.log(`[Worker:GenerateVisual] - Image: "${result.altText.substring(0,50)}..." | Sim: ${similarity.toFixed(3)} | Attr Bonus: ${attributionBonus.toFixed(3)} | Final: ${finalScore.toFixed(3)}`);
        return { ...result, score: finalScore };
    });

    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score);

    // Find the best result above the threshold
    const bestMatch = scoredResults[0]; // Highest score is first

    if (bestMatch && bestMatch.score >= similarityThreshold) {
        console.log(`[Worker:GenerateVisual] Best match found: "${bestMatch.altText.substring(0,50)}..." with score ${bestMatch.score.toFixed(3)} (Threshold: ${similarityThreshold})`);
        return bestMatch;
    } else {
        console.log(`[Worker:GenerateVisual] No image met the similarity threshold of ${similarityThreshold}. Highest score was ${bestMatch?.score?.toFixed(3) ?? 'N/A'}.`);
        return null;
    }
}
// ------------------------------------------------------------- 