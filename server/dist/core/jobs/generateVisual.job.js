"use strict";
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
const db_1 = require("../../core/db");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const job_definition_1 = require("./job.definition");
const image_search_1 = require("../../modules/ai/utils/image-search"); // Import image search utility
const queue_1 = require("./queue"); // Import queue
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
        var _a, _b, _c, _d;
        const { visualId, sourceId } = job.data;
        console.log(`[Worker:GenerateVisual] Starting job for visual ID: ${visualId} (Source: ${sourceId})`);
        let visualRecord;
        try {
            // 1. Update visual status to PROCESSING
            yield db_1.db.update(schema_1.visuals)
                .set({ status: 'PROCESSING' })
                .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
            // 2. Fetch visual record
            visualRecord = yield db_1.db.query.visuals.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId),
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
            const imageUrl = yield (0, image_search_1.searchImage)(searchQuery);
            if (!imageUrl) {
                // Handle search/generation failure
                console.warn(`[Worker:GenerateVisual] Image search failed for visual ID: ${visualId}`);
                yield db_1.db.update(schema_1.visuals)
                    .set({ status: 'FAILED', errorMessage: 'Image search failed' })
                    .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
                // Do not re-throw, allow other visuals to process. Failure is recorded.
            }
            else {
                // 4. Update visual record with URL and mark COMPLETED
                yield db_1.db.update(schema_1.visuals)
                    .set({ status: 'COMPLETED', imageUrl: imageUrl })
                    .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
                console.log(`[Worker:GenerateVisual] Successfully processed visual ID: ${visualId}.`);
            }
            // 5. Check if all visuals for this sourceId are done (COMPLETED or FAILED)
            // Need to use a raw query or count for this check
            const pendingOrProcessing = yield db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
                .from(schema_1.visuals)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.visuals.sourceId, sourceId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PENDING'), (0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PROCESSING'))));
            const remainingCount = (_b = (_a = pendingOrProcessing[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 1; // Assume 1 if query fails, to be safe
            console.log(`[Worker:GenerateVisual] Checking completion for source ${sourceId}. Remaining visuals: ${remainingCount}`);
            if (remainingCount === 0) {
                console.log(`[Worker:GenerateVisual] All visuals processed for source ID: ${sourceId}. Enqueuing assembly.`);
                const assemblyPayload = { sourceId };
                yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.ASSEMBLE_NOTE, assemblyPayload);
                // Update source stage
                yield db_1.db.update(schema_1.sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            }
            console.log(`[Worker:GenerateVisual] Finished job for visual ID: ${visualId}`);
        }
        catch (error) {
            console.error(`[Worker:GenerateVisual] Error processing job for visual ID: ${visualId}`, error);
            // Update visual status to FAILED if an unexpected error occurred
            if (visualId) { // Ensure visualId is defined before trying to update
                yield db_1.db.update(schema_1.visuals)
                    .set({
                    status: 'FAILED',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error during visual generation'
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.visuals.id, visualId));
                // After failure, still check if this was the *last* pending one
                try {
                    const pendingOrProcessing = yield db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
                        .from(schema_1.visuals)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.visuals.sourceId, sourceId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PENDING'), (0, drizzle_orm_1.eq)(schema_1.visuals.status, 'PROCESSING'))));
                    const remainingCount = (_d = (_c = pendingOrProcessing[0]) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 1;
                    if (remainingCount === 0) {
                        console.log(`[Worker:GenerateVisual] All visuals processed (including failures) for source ID: ${sourceId}. Enqueuing assembly.`);
                        const assemblyPayload = { sourceId };
                        yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.ASSEMBLE_NOTE, assemblyPayload);
                        yield db_1.db.update(schema_1.sources).set({ processingStage: 'ASSEMBLY_PENDING' }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
                    }
                }
                catch (checkError) {
                    console.error(`[Worker:GenerateVisual] Error checking completion status after failure for source ${sourceId}`, checkError);
                }
            }
            // Do not re-throw error here to allow other visuals to process
        }
    });
}
