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
exports.processYouTubeTranscriptionJob = processYouTubeTranscriptionJob;
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const queue_1 = require("./queue");
const youtubeTranscript_1 = require("../../modules/media/utils/youtubeTranscript");
function processYouTubeTranscriptionJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const { sourceId } = job.data;
        if (!sourceId || typeof sourceId !== 'number') {
            console.error(`[YouTubeJob] Invalid sourceId:`, sourceId);
            throw new Error('Invalid sourceId in job data');
        }
        let source;
        try {
            // 1. Fetch the source record
            const sourceResult = yield index_1.db.select().from(schema_1.sources).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId)).limit(1);
            if (!sourceResult || sourceResult.length === 0) {
                throw new Error(`Source record not found for ID: ${sourceId}`);
            }
            source = sourceResult[0];
            if (source.sourceType !== 'YOUTUBE' || !source.originalUrl) {
                throw new Error(`Source ${sourceId} is not a YOUTUBE type or missing originalUrl.`);
            }
            // 2. Update status to PROCESSING
            yield index_1.db.update(schema_1.sources)
                .set({ processingStatus: 'PROCESSING', processingStage: 'TRANSCRIPTION_IN_PROGRESS' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            // 3. Fetch transcript
            let transcriptSegments;
            try {
                transcriptSegments = yield (0, youtubeTranscript_1.getYouTubeTranscript)(source.originalUrl);
            }
            catch (err) {
                yield index_1.db.update(schema_1.sources)
                    .set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION_FAILED', processingError: err.message || 'Failed to fetch YouTube transcript' })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
                throw err;
            }
            if (!transcriptSegments || transcriptSegments.length === 0) {
                throw new Error('Transcript extraction returned no segments.');
            }
            // 4. Combine transcript text
            const transcriptText = transcriptSegments.map(seg => seg.text).join(' ');
            // 5. Update source with transcript and metadata
            yield index_1.db.update(schema_1.sources)
                .set({
                extractedText: transcriptText,
                metadata: Object.assign(Object.assign({}, (source.metadata || {})), { transcript: transcriptSegments }),
                processingStatus: 'PENDING', // Ready for next stage
                processingStage: 'AI_ANALYSIS_PENDING',
                processingError: null,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            // 6. Enqueue next job
            yield queue_1.noteProcessingQueue.add('PROCESS_SOURCE_TEXT', { sourceId });
            console.log(`[YouTubeJob] Successfully processed YouTube transcript for sourceId: ${sourceId}`);
        }
        catch (error) {
            console.error(`[YouTubeJob] Failed for sourceId: ${sourceId}`, error);
            // Error status already set above if transcript fetch failed
            if (source && (!source.processingStatus || source.processingStatus !== 'FAILED')) {
                yield index_1.db.update(schema_1.sources)
                    .set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION_FAILED', processingError: error.message })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            }
            throw error;
        }
    });
}
