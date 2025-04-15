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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAudioTranscriptionJob = processAudioTranscriptionJob;
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const path_1 = __importDefault(require("path"));
const elevenlabs_processor_1 = require("../../modules/media/processors/elevenlabs.processor");
const queue_1 = require("./queue");
/**
 * Handles the PROCESS_AUDIO_TRANSCRIPTION job.
 * Fetches the source, calls the transcription service, and updates status.
 */
function processAudioTranscriptionJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const { sourceId } = job.data;
        if (!sourceId || typeof sourceId !== 'number') {
            console.error(`[Job ${job.id}] Invalid sourceId provided:`, sourceId);
            throw new Error('Invalid sourceId in job data');
        }
        console.log(`[Job ${job.id}] Starting PROCESS_AUDIO_TRANSCRIPTION for sourceId: ${sourceId}`);
        let source;
        try {
            // 1. Fetch the source record
            const sourceResult = yield index_1.db.select().from(schema_1.sources).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId)).limit(1);
            if (!sourceResult || sourceResult.length === 0) {
                throw new Error(`Source record not found for ID: ${sourceId}`);
            }
            source = sourceResult[0];
            if (source.sourceType !== 'AUDIO') {
                throw new Error(`Source ${sourceId} is not an AUDIO type.`);
            }
            // 2. Update status to PROCESSING
            yield index_1.db.update(schema_1.sources)
                .set({ processingStatus: 'PROCESSING', processingStage: 'TRANSCRIPTION_IN_PROGRESS' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Job ${job.id}] Updated source ${sourceId} status to PROCESSING`);
            // 3. Get the audio file path (This needs refinement based on how paths are stored/resolved)
            // The route handler saved it relative to the project root (e.g., uploads/audio/1/...). 
            // We need the absolute path here, or adjust the media service to handle relative paths.
            // ** Placeholder: Assume metadata stores the relative path **
            const metadata = source.metadata;
            const relativePath = metadata === null || metadata === void 0 ? void 0 : metadata.storagePath;
            if (!relativePath) {
                throw new Error(`Storage path missing in metadata for source ${sourceId}`);
            }
            const absoluteFilePath = path_1.default.resolve(__dirname, '../../..', relativePath); // Adjust relative path calculation
            const languageCode = metadata === null || metadata === void 0 ? void 0 : metadata.languageCode;
            // 4. Call the actual transcription service (using MediaService or directly)
            console.log(`[Job ${job.id}] Calling transcription service for file: ${absoluteFilePath}`);
            // --- Replace simulation with actual call --- 
            const transcriptResult = yield (0, elevenlabs_processor_1.processAudioWithElevenLabs)(absoluteFilePath, languageCode);
            if (!transcriptResult || !transcriptResult.transcript) {
                throw new Error('Transcription failed or returned empty result.');
            }
            console.log(`[Job ${job.id}] Transcription successful. Transcript length: ${transcriptResult.transcript.length}`);
            // --- End Replace --- 
            // 5. Update status and store transcript
            // The transcription service itself might update the final text in the source record.
            // Here, we just mark the transcription stage as done.
            // The next job (PROCESS_SOURCE_TEXT) will handle AI analysis.
            yield index_1.db.update(schema_1.sources)
                .set({
                processingStatus: 'PENDING', // Reset to PENDING for the next stage
                processingStage: 'AI_ANALYSIS_PENDING',
                extractedText: transcriptResult.transcript, // Store the full transcript
                // Store word timestamps if needed, potentially in metadata
                metadata: Object.assign(Object.assign({}, metadata), { wordTimestamps: transcriptResult.words, transcriptionProvider: 'elevenlabs' // Track which provider succeeded (adjust if fallback used)
                 })
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Job ${job.id}] Updated source ${sourceId} with transcript and status for AI Analysis`);
            // 6. Enqueue the next job (e.g., PROCESS_SOURCE_TEXT)
            yield queue_1.noteProcessingQueue.add('PROCESS_SOURCE_TEXT', { sourceId });
            console.log(`[Job ${job.id}] Enqueued PROCESS_SOURCE_TEXT job for sourceId: ${sourceId}`);
        }
        catch (error) {
            console.error(`[Job ${job.id}] Failed PROCESS_AUDIO_TRANSCRIPTION for sourceId: ${sourceId}`, error);
            // Update status to FAILED
            try {
                yield index_1.db.update(schema_1.sources)
                    .set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION_FAILED', processingError: error.message })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            }
            catch (dbError) {
                console.error(`[Job ${job.id}] Failed to update source ${sourceId} status to FAILED after error:`, dbError);
            }
            // Re-throw the error so BullMQ marks the job as failed
            throw error;
        }
    });
}
