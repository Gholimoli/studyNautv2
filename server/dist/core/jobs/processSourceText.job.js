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
exports.processSourceTextJob = processSourceTextJob;
const db_1 = require("../../core/db");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const ai_service_1 = require("../../modules/ai/ai.service");
// Import Job Types and Queue
const job_definition_1 = require("./job.definition");
const queue_1 = require("./queue");
/**
 * Job processor for handling initial text processing.
 * - Fetches source text.
 * - (Later) Calls AI service to generate structure.
 * - Updates source status.
 */
function processSourceTextJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const { sourceId } = job.data;
        console.log(`[Worker:ProcessSourceText] Starting job for source ID: ${sourceId}`);
        let sourceRecord;
        try {
            // 1. Update status to PROCESSING and set stage
            yield db_1.db.update(schema_1.sources)
                .set({ processingStatus: 'PROCESSING', processingStage: 'AI_ANALYSIS' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker:ProcessSourceText] Set status to PROCESSING for source ID: ${sourceId}`);
            // 2. Fetch the source record
            sourceRecord = yield db_1.db.query.sources.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
            });
            if (!sourceRecord || !sourceRecord.extractedText) {
                throw new Error(`Source record or extracted text not found for ID: ${sourceId}`);
            }
            // 3. Call AI Service to generate lesson structure
            console.log(`[Worker:ProcessSourceText] Calling AI service for source ID: ${sourceId}...`);
            const aiResult = yield ai_service_1.aiService.generateLessonStructure(sourceRecord.extractedText);
            if (!aiResult) {
                // Error already logged within AiService
                throw new Error(`AI service failed to generate structure for source ID: ${sourceId}`);
            }
            console.log(`[Worker:ProcessSourceText] AI analysis successful for source ID: ${sourceId}`);
            // 4. Update source record with AI result (store structured content in metadata)
            // Combine with existing metadata if any
            const updatedMetadata = Object.assign(Object.assign({}, (sourceRecord.metadata || {})), { aiStructure: aiResult // Contains title, summary, structure array
             });
            yield db_1.db.update(schema_1.sources)
                .set({
                metadata: updatedMetadata,
                processingStage: 'VISUAL_PROCESSING_PENDING' // Set stage for next step
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker:ProcessSourceText] Stored AI structure in metadata for source ID: ${sourceId}`);
            // 5. Enqueue PROCESS_VISUAL_PLACEHOLDERS job
            const nextJobPayload = { sourceId };
            yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_VISUAL_PLACEHOLDERS, nextJobPayload);
            console.log(`[Worker:ProcessSourceText] Enqueued ${job_definition_1.JobType.PROCESS_VISUAL_PLACEHOLDERS} job for source ID: ${sourceId}`);
            console.log(`[Worker:ProcessSourceText] Successfully finished job for source ID: ${sourceId}`);
        }
        catch (error) {
            console.error(`[Worker:ProcessSourceText] Error processing job for source ID: ${sourceId}`, error);
            // Update status to FAILED
            yield db_1.db.update(schema_1.sources)
                .set({
                processingStatus: 'FAILED',
                processingError: error instanceof Error ? error.message : 'Unknown processing error',
                processingStage: (sourceRecord === null || sourceRecord === void 0 ? void 0 : sourceRecord.processingStage) || 'AI_ANALYSIS' // Record stage where it failed
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            // Re-throw the error so BullMQ knows the job failed
            throw error;
        }
    });
}
