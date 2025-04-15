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
exports.processVisualPlaceholdersJob = processVisualPlaceholdersJob;
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const queue_1 = require("./queue");
const job_definition_1 = require("./job.definition");
/**
 * Job processor for handling visual placeholders identified by AI.
 * - Fetches AI structure from source metadata.
 * - Creates visual records in the database.
 * - Enqueues GENERATE_VISUAL job for each.
 */
function processVisualPlaceholdersJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const { sourceId } = job.data;
        console.log(`[Worker:ProcessVisualPlaceholders] Starting job for source ID: ${sourceId}`);
        let sourceRecord;
        try {
            // 1. Fetch the source record, ensuring metadata includes aiStructure
            sourceRecord = yield index_1.db.query.sources.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
                columns: { metadata: true }, // Only need metadata
            });
            if (!sourceRecord || !sourceRecord.metadata || !sourceRecord.metadata.aiStructure) {
                throw new Error(`Source record or AI structure in metadata not found for ID: ${sourceId}`);
            }
            const aiStructure = sourceRecord.metadata.aiStructure;
            const visualOpportunities = aiStructure.visualOpportunities;
            if (!visualOpportunities || visualOpportunities.length === 0) {
                console.log(`[Worker:ProcessVisualPlaceholders] No visual opportunities found for source ID: ${sourceId}. Proceeding to assembly.`);
                // If no visuals, directly enqueue the final assembly job
                yield index_1.db.update(schema_1.sources)
                    .set({ processingStage: 'ASSEMBLY_PENDING' })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
                // Enqueue the next job
                yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.ASSEMBLE_NOTE, { sourceId });
                console.log(`[Worker:ProcessVisualPlaceholders] Enqueued ${job_definition_1.JobType.ASSEMBLE_NOTE} job for source ID: ${sourceId}`);
                return; // Nothing more to do in this job
            }
            console.log(`[Worker:ProcessVisualPlaceholders] Found ${visualOpportunities.length} visual opportunities for source ID: ${sourceId}.`);
            // 2. Create visual records and enqueue GENERATE_VISUAL jobs
            const visualCreationPromises = visualOpportunities.map((opp) => __awaiter(this, void 0, void 0, function* () {
                if (!opp.placeholderId || !opp.description) {
                    console.warn(`[Worker:ProcessVisualPlaceholders] Skipping invalid visual opportunity for source ${sourceId}:`, opp);
                    return null;
                }
                const newVisual = yield index_1.db.insert(schema_1.visuals).values({
                    sourceId: sourceId,
                    placeholderId: opp.placeholderId,
                    description: opp.description,
                    searchQuery: opp.searchQuery,
                    status: 'PENDING',
                }).returning({ id: schema_1.visuals.id });
                if (!newVisual || newVisual.length === 0) {
                    console.error(`[Worker:ProcessVisualPlaceholders] Failed to create visual record for opportunity:`, opp);
                    return null; // Don't enqueue if DB insert failed
                }
                const visualId = newVisual[0].id;
                const jobPayload = { visualId, sourceId };
                yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.GENERATE_VISUAL, jobPayload);
                console.log(`[Worker:ProcessVisualPlaceholders] Enqueued ${job_definition_1.JobType.GENERATE_VISUAL} job for visual ID: ${visualId} (Source: ${sourceId})`);
                return visualId;
            }));
            const createdVisualIds = (yield Promise.all(visualCreationPromises)).filter(id => id !== null);
            console.log(`[Worker:ProcessVisualPlaceholders] Successfully created ${createdVisualIds.length} visual records and enqueued jobs for source ID: ${sourceId}.`);
            // 3. Update source stage
            yield index_1.db.update(schema_1.sources)
                .set({ processingStage: 'GENERATING_VISUALS' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker:ProcessVisualPlaceholders] Successfully finished job for source ID: ${sourceId}`);
        }
        catch (error) {
            console.error(`[Worker:ProcessVisualPlaceholders] Error processing job for source ID: ${sourceId}`, error);
            // Update status to FAILED
            yield index_1.db.update(schema_1.sources)
                .set({
                processingStatus: 'FAILED',
                processingError: error instanceof Error ? error.message : 'Error processing visual placeholders',
                processingStage: 'VISUAL_PROCESSING_PENDING' // Stage where it failed
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            throw error;
        }
    });
}
