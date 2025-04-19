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
const storage_service_1 = require("../services/storage.service");
const os = __importStar(require("os"));
const fs = __importStar(require("fs/promises"));
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
        let tempLocalPath = null;
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
            const storagePath = metadata === null || metadata === void 0 ? void 0 : metadata.storagePath;
            if (!storagePath) {
                throw new Error(`Storage path missing in metadata for source ${sourceId}`);
            }
            const languageCode = metadata === null || metadata === void 0 ? void 0 : metadata.languageCode;
            // 3b. Download file from Supabase to a temporary local path
            const tempFilename = `${Date.now()}-${path_1.default.basename(storagePath)}`;
            tempLocalPath = path_1.default.join(os.tmpdir(), tempFilename);
            console.log(`[Job ${job.id}] Downloading ${storagePath} from Supabase to ${tempLocalPath}`);
            yield storage_service_1.storageService.downloadFile(storagePath, tempLocalPath);
            console.log(`[Job ${job.id}] Successfully downloaded file to ${tempLocalPath}`);
            // 4. Call the actual transcription service (using MediaService or directly)
            console.log(`[Job ${job.id}] Calling transcription service for local file: ${tempLocalPath}`);
            // --- Replace simulation with actual call --- 
            const transcriptResult = yield (0, elevenlabs_processor_1.processAudioWithElevenLabs)(tempLocalPath, languageCode);
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
        finally {
            // 7. Cleanup: Delete the temporary local file if it was created
            if (tempLocalPath) {
                try {
                    yield fs.unlink(tempLocalPath);
                    console.log(`[Job ${job.id}] Deleted temporary local file: ${tempLocalPath}`);
                }
                catch (cleanupError) {
                    console.error(`[Job ${job.id}] Failed to delete temporary local file ${tempLocalPath}:`, cleanupError);
                    // Log the error but don't fail the job just for cleanup failure
                }
            }
        }
    });
}
