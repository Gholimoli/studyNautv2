"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVisualJob = generateVisualJob;
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const job_definition_1 = require("./job.definition");
const image_search_1 = require("../../modules/ai/utils/image-search");
const queue_1 = require("./queue");
const stringSimilarity = __importStar(require("string-similarity"));
// import { searchImage } from '../../modules/ai/utils/image-search'; // TODO: Import later
// import { JobType, AssembleNotePayload } from './job.definition'; // TODO: Import later
// import { noteProcessingQueue } from './queue'; // TODO: Import later
/**
 * Job processor for generating or finding a visual for a placeholder.
 * - Fetches visual details (description, query).
 * - Calls image search/generation utility.
 * - Updates visual record with URL or error.
 * - Checks if all visuals for the source are done to enqueue assembly.
 */
function generateVisualJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { visualId, sourceId } = job.data;
        console.log(`[Worker:GenerateVisual] Starting job for visual ID: ${visualId} (Source: ${sourceId})`);
        let visualRecord;
        try {
            // 1. Update visual status to PROCESSING
            yield index_1.db.update(schema_1.visuals)
                .set({ status: 'PROCESSING' })
                .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
            // 2. Fetch visual record
            visualRecord = yield index_1.db.query.visuals.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId),
                columns: { description: true, searchQuery: true }, // Only fetch needed fields
            });
            if (!visualRecord) {
                throw new Error(`Visual record not found for ID: ${visualId}`);
            }
            // Use searchQuery first, fallback to description if null/empty
            const query = ((_a = visualRecord.searchQuery) === null || _a === void 0 ? void 0 : _a.trim()) || visualRecord.description;
            if (!query) {
                throw new Error(`Visual record ID ${visualId} missing description and searchQuery.`);
            }
            // 3. Call Image Search Utility to get multiple results
            console.log(`[Worker:GenerateVisual] Searching for images for visual ID: ${visualId} with query: "${query.substring(0, 50)}..."`);
            let imageResults = null;
            let searchError = null;
            try {
                imageResults = yield (0, image_search_1.searchImages)(query, 5); // Request top 5 images for better selection pool
            }
            catch (error) {
                searchError = error instanceof Error ? error : new Error('Unknown image search error');
                console.error(`[Worker:GenerateVisual] Image search failed for visual ID: ${visualId}`, searchError);
            }
            // Check for specific errors like account limits
            const isAccountLimitError = (_b = searchError === null || searchError === void 0 ? void 0 : searchError.message) === null || _b === void 0 ? void 0 : _b.includes('Your account has run out of searches');
            if (searchError) {
                // Handle image search API error
                console.error(`[Worker:GenerateVisual] Image search API error for visual ID: ${visualId}: ${searchError.message}`);
                yield index_1.db.update(schema_1.visuals)
                    .set({
                    status: 'FAILED',
                    errorMessage: isAccountLimitError
                        ? 'Image search failed: Account limit reached.'
                        : `Image search API error: ${searchError.message.substring(0, 200)}`
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
            }
            else if (!imageResults || imageResults.length === 0) {
                // Handle no results found initially
                console.warn(`[Worker:GenerateVisual] No image results returned by search API for visual ID: ${visualId}`);
                yield index_1.db.update(schema_1.visuals)
                    .set({ status: 'NO_IMAGE_FOUND', errorMessage: 'No suitable images found by search API' })
                    .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
            }
            else {
                // 4. Select the best image using similarity scoring
                const selectedImage = findBestImageBySimilarity(imageResults, visualRecord.description || '');
                if (selectedImage) {
                    // 5. Update visual record with selected image details and mark COMPLETED
                    console.log(`[Worker:GenerateVisual] Updating DB for visual ID ${visualId} with selected image: ${selectedImage.imageUrl.substring(0, 80)}...`);
                    // --- Improved Alt Text --- 
                    // Prioritize the description provided by the AI for better context
                    const finalAltText = ((_c = visualRecord === null || visualRecord === void 0 ? void 0 : visualRecord.description) === null || _c === void 0 ? void 0 : _c.trim()) || selectedImage.altText;
                    console.log(`[Worker:GenerateVisual] Using alt text: "${finalAltText.substring(0, 80)}..."`);
                    // -----------------------
                    yield index_1.db.update(schema_1.visuals)
                        .set({
                        status: 'COMPLETED',
                        imageUrl: selectedImage.imageUrl,
                        altText: finalAltText, // Use the determined alt text
                        sourceUrl: selectedImage.sourceUrl,
                        sourceTitle: selectedImage.sourceTitle,
                        errorMessage: null // Clear any previous error message
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
                    console.log(`[Worker:GenerateVisual] Successfully processed visual ID: ${visualId}.`);
                }
                else {
                    // Handle no image meeting similarity threshold
                    console.warn(`[Worker:GenerateVisual] No image met similarity threshold for visual ID: ${visualId}`);
                    yield index_1.db.update(schema_1.visuals)
                        .set({ status: 'NO_IMAGE_FOUND', errorMessage: 'No sufficiently relevant images found' })
                        .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
                }
            }
            // 6. Check if all visuals for this sourceId are done (COMPLETED, FAILED, or NO_IMAGE_FOUND)
            // Need to use a raw query or count for this check
            const pendingOrProcessing = yield index_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
                .from(schema_1.visuals)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.visuals.sourceId, sourceId), 
            // Check for statuses that mean processing is NOT finished
            (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PENDING'), (0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PENDING_GENERATION'), (0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PROCESSING'))));
            const remainingCount = (_e = (_d = pendingOrProcessing[0]) === null || _d === void 0 ? void 0 : _d.count) !== null && _e !== void 0 ? _e : 1; // Assume 1 if query fails, to be safe
            console.log(`[Worker:GenerateVisual] Checking completion for source ${sourceId}. Remaining visuals needing processing: ${remainingCount}`);
            if (remainingCount === 0) {
                // Check if the source itself is still in the right stage
                const currentSource = yield index_1.db.query.sources.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
                    columns: { processingStage: true }
                });
                if ((currentSource === null || currentSource === void 0 ? void 0 : currentSource.processingStage) === 'GENERATING_VISUALS') {
                    console.log(`[Worker:GenerateVisual] All visuals processed for source ID: ${sourceId}. Enqueuing assembly.`);
                    const assemblyPayload = { sourceId };
                    yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.ASSEMBLE_NOTE, assemblyPayload);
                    // Update source stage
                    yield index_1.db.update(schema_1.sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
                }
                else {
                    console.log(`[Worker:GenerateVisual] All visuals processed for source ${sourceId}, but source stage is already '${currentSource === null || currentSource === void 0 ? void 0 : currentSource.processingStage}'. Assembly job likely already enqueued.`);
                }
            }
            console.log(`[Worker:GenerateVisual] Finished job for visual ID: ${visualId}`);
        }
        catch (error) {
            console.error(`[Worker:GenerateVisual] FATAL Error processing job for visual ID: ${visualId}`, error);
            // Update visual status to FAILED if an unexpected error occurred
            if (visualId) { // Ensure visualId is defined before trying to update
                try {
                    yield index_1.db.update(schema_1.visuals)
                        .set({
                        status: 'FAILED',
                        errorMessage: error instanceof Error ? error.message : 'Unknown error during visual generation'
                    })
                        .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
                }
                catch (dbError) {
                    console.error(`[Worker:GenerateVisual] Failed to update visual status to FAILED for visual ${visualId} after main error:`, dbError);
                }
                // After failure, still check if this was the *last* pending one to enqueue assembly
                try {
                    const pendingOrProcessing = yield index_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
                        .from(schema_1.visuals)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.visuals.sourceId, sourceId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PENDING'), (0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PENDING_GENERATION'), (0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PROCESSING'))));
                    const remainingCount = (_g = (_f = pendingOrProcessing[0]) === null || _f === void 0 ? void 0 : _f.count) !== null && _g !== void 0 ? _g : 1;
                    if (remainingCount === 0) {
                        const currentSource = yield index_1.db.query.sources.findFirst({
                            where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
                            columns: { processingStage: true }
                        });
                        if ((currentSource === null || currentSource === void 0 ? void 0 : currentSource.processingStage) === 'GENERATING_VISUALS') {
                            console.log(`[Worker:GenerateVisual] All visuals processed (including fatal error on ${visualId}) for source ID: ${sourceId}. Enqueuing assembly.`);
                            const assemblyPayload = { sourceId };
                            yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.ASSEMBLE_NOTE, assemblyPayload);
                            yield index_1.db.update(schema_1.sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
                        }
                        else {
                            console.log(`[Worker:GenerateVisual] All visuals processed for source ${sourceId} (including fatal error on ${visualId}), but source stage is already '${currentSource === null || currentSource === void 0 ? void 0 : currentSource.processingStage}'. Assembly job likely already enqueued.`);
                        }
                    }
                }
                catch (checkError) {
                    console.error(`[Worker:GenerateVisual] Error checking completion status after failure for source ${sourceId}`, checkError);
                }
            }
            // Do not re-throw error here to allow other visuals to process, but log it as FATAL
        }
    });
}
// --- Helper function to find the best image based on similarity ---
function findBestImageBySimilarity(results, targetDescription, similarityThreshold = 0.15 // Configurable threshold (0 to 1) - Lowered default
) {
    var _a, _b;
    if (!results || results.length === 0 || !targetDescription) {
        return null;
    }
    console.log(`[Worker:GenerateVisual] Scoring ${results.length} image results against description: "${targetDescription.substring(0, 50)}..."`);
    const scoredResults = results.map(result => {
        // Compare target description against the image title (most reliable field)
        const similarity = stringSimilarity.compareTwoStrings(targetDescription.toLowerCase(), result.altText.toLowerCase() // Use altText (which is image title)
        );
        // Add a small bonus for having source info, penalize slightly if missing
        const attributionBonus = (result.sourceUrl && result.sourceTitle) ? 0.05 : -0.02;
        const finalScore = similarity + attributionBonus;
        console.log(`[Worker:GenerateVisual] - Image: "${result.altText.substring(0, 50)}..." | Sim: ${similarity.toFixed(3)} | Attr Bonus: ${attributionBonus.toFixed(3)} | Final: ${finalScore.toFixed(3)}`);
        return Object.assign(Object.assign({}, result), { score: finalScore });
    });
    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score);
    // Find the best result above the threshold
    const bestMatch = scoredResults[0]; // Highest score is first
    if (bestMatch && bestMatch.score >= similarityThreshold) {
        console.log(`[Worker:GenerateVisual] Best match found: "${bestMatch.altText.substring(0, 50)}..." with score ${bestMatch.score.toFixed(3)} (Threshold: ${similarityThreshold})`);
        return bestMatch;
    }
    else {
        console.log(`[Worker:GenerateVisual] No image met the similarity threshold of ${similarityThreshold}. Highest score was ${(_b = (_a = bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.score) === null || _a === void 0 ? void 0 : _a.toFixed(3)) !== null && _b !== void 0 ? _b : 'N/A'}.`);
        return null;
    }
}
// ------------------------------------------------------------- 
