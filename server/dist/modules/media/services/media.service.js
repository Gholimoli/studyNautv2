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
exports.mediaService = exports.MediaService = void 0;
const db_1 = require("../../../core/db");
const schema_1 = require("../../../core/db/schema");
const queue_1 = require("../../../core/jobs/queue");
const job_definition_1 = require("../../../core/jobs/job.definition");
const drizzle_orm_1 = require("drizzle-orm");
class MediaService {
    createSourceFromText(data, user) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[MediaService] Creating text source for user ${user.id}`);
            const newSource = yield db_1.db.insert(schema_1.sources).values({
                userId: user.id,
                sourceType: 'TEXT', // Set source type
                extractedText: data.text, // Store the provided text
                metadata: data.title ? { title: data.title } : {}, // Store optional title
                processingStatus: 'PENDING', // Initial status
                // processingStage will be set by the first job
            }).returning({
                id: schema_1.sources.id,
                sourceType: schema_1.sources.sourceType,
                processingStatus: schema_1.sources.processingStatus,
            });
            if (!newSource || newSource.length === 0) {
                throw new Error('Failed to create source record'); // Use custom errors later
            }
            const createdSource = newSource[0];
            console.log(`[MediaService] Source record created with ID: ${createdSource.id}`);
            // Enqueue the job
            try {
                yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_SOURCE_TEXT, { sourceId: createdSource.id });
                console.log(`[MediaService] Enqueued ${job_definition_1.JobType.PROCESS_SOURCE_TEXT} job for source ID: ${createdSource.id}`);
            }
            catch (queueError) {
                console.error(`[MediaService] Failed to enqueue job for source ID: ${createdSource.id}`, queueError);
                // Decide how to handle enqueue failure - maybe mark source as failed?
                // For now, we'll still return success to the user, but log the error.
                yield db_1.db.update(schema_1.sources)
                    .set({ processingStatus: 'FAILED', processingError: 'Failed to enqueue processing job' })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, createdSource.id)); // Need eq from drizzle-orm
                // Re-throwing might be better in some cases, but could lead to complex frontend handling
            }
            return {
                sourceId: createdSource.id,
                message: "Text source received, processing initiated."
            };
        });
    }
}
exports.MediaService = MediaService;
exports.mediaService = new MediaService();
