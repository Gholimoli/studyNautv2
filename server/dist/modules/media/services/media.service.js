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
exports.mediaService = exports.MediaService = void 0;
const db_1 = require("@/core/db");
const schema_1 = require("@/core/db/schema");
const queue_1 = require("@/core/jobs/queue");
const job_definition_1 = require("@/core/jobs/job.definition");
const drizzle_orm_1 = require("drizzle-orm");
const storage_service_1 = require("@/core/services/storage.service"); // Import StorageService
const fs = __importStar(require("fs/promises")); // Import fs promises for deletion
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
                yield db_1.db.update(schema_1.sources)
                    .set({ processingStatus: 'FAILED', processingError: 'Failed to enqueue processing job' })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, createdSource.id));
            }
            return {
                sourceId: createdSource.id,
                message: "Text source received, processing initiated."
            };
        });
    }
    /**
     * Handles processing of an uploaded audio file.
     * Uploads to Supabase, creates source record, and queues transcription job.
     * @param file The uploaded file object (containing path, originalname, mimetype).
     * @param user The authenticated user.
     * @param languageCode Optional language code for transcription.
     * @returns The result containing the new source ID.
     */
    createSourceFromAudioUpload(file, user, languageCode) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[MediaService] Processing audio upload for user ${user.id}: ${file.originalname}`);
            let storagePath = null;
            try {
                // 1. Construct storage path (e.g., user_123/audio/timestamp_filename.mp3)
                const timestamp = Date.now();
                const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
                storagePath = `user_${user.id}/audio/${timestamp}_${safeFilename}`;
                // 2. Upload to Supabase Storage
                const uploadedPath = yield storage_service_1.storageService.uploadFile(file.path, // Local temporary path from multer
                storagePath, file.mimetype);
                if (!uploadedPath) {
                    throw new Error('Storage service failed to return a path after upload.');
                }
                console.log(`[MediaService] Successfully uploaded to Supabase: ${storagePath}`);
                // 3. Delete local temporary file AFTER successful upload
                try {
                    yield fs.unlink(file.path);
                    console.log(`[MediaService] Deleted local temp file: ${file.path}`);
                }
                catch (unlinkError) {
                    // Log deletion error but don't fail the whole process
                    console.error(`[MediaService] Failed to delete local temp file ${file.path}:`, unlinkError);
                }
                // 4. Create source record in DB
                const newSource = yield db_1.db.insert(schema_1.sources).values({
                    userId: user.id,
                    sourceType: 'AUDIO',
                    originalFilename: file.originalname,
                    originalStoragePath: storagePath, // Save the Supabase path
                    metadata: languageCode ? { languageCode: languageCode } : {},
                    processingStatus: 'PENDING',
                }).returning({
                    id: schema_1.sources.id,
                });
                if (!newSource || newSource.length === 0) {
                    throw new Error('Failed to create source record after upload');
                }
                const createdSource = newSource[0];
                console.log(`[MediaService] Source record created for audio upload with ID: ${createdSource.id}`);
                // 5. Enqueue the transcription job
                yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_AUDIO_TRANSCRIPTION, {
                    sourceId: createdSource.id,
                    audioFilePath: storagePath, // Pass Supabase path to job? Or let job fetch it?
                    // For now, let's assume the job needs the storage path to fetch the file later.
                    languageCode: languageCode
                });
                console.log(`[MediaService] Enqueued ${job_definition_1.JobType.PROCESS_AUDIO_TRANSCRIPTION} job for source ID: ${createdSource.id}`);
                return {
                    sourceId: createdSource.id,
                    message: "Audio file uploaded successfully, transcription initiated."
                };
            }
            catch (error) {
                console.error(`[MediaService] Error processing audio upload for user ${user.id}:`, error);
                // Cleanup attempt: If upload succeeded but DB/queue failed, try deleting from Supabase
                if (storagePath) {
                    console.warn(`[MediaService] Attempting to clean up Supabase file due to error: ${storagePath}`);
                    yield storage_service_1.storageService.deleteFile(storagePath);
                }
                // Also ensure local file is deleted if it wasn't already
                try {
                    // Simply attempt to delete the file
                    yield fs.unlink(file.path);
                    console.log(`[MediaService] Deleted local temp file during error cleanup: ${file.path}`);
                }
                catch (cleanupError) {
                    // Ignore ENOENT errors (file already deleted or never existed), log others
                    if (cleanupError.code !== 'ENOENT') {
                        console.error(`[MediaService] Error during local file cleanup after error:`, cleanupError);
                    }
                }
                // Re-throw a user-friendly error or handle specific errors
                throw new Error(`Failed to process audio upload: ${error.message}`);
            }
        });
    }
}
exports.MediaService = MediaService;
exports.mediaService = new MediaService();
