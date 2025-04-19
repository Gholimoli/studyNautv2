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
const db_1 = require("../../../core/db");
const schema_1 = require("../../../core/db/schema");
const queue_1 = require("../../../core/jobs/queue");
const job_definition_1 = require("../../../core/jobs/job.definition");
const drizzle_orm_1 = require("drizzle-orm");
const storage_service_1 = require("../../../core/services/storage.service"); // Import StorageService
const fs = __importStar(require("fs/promises")); // Import fs promises for deletion
const franc_all_1 = require("franc-all"); // Import language detection library
const zod_1 = require("zod"); // Added Zod for URL validation
class MediaService {
    createSourceFromText(data, user) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[MediaService] Creating text source for user ${user.id}`);
            // Detect language (ISO 639-3)
            const langGuesses = (0, franc_all_1.francAll)(data.text.substring(0, 1000), { minLength: 3 });
            const detectedLang3 = langGuesses.length > 0 ? langGuesses[0][0] : 'und'; // Get the top guess (ISO 639-3) or 'und'
            // Use 'eng' as the effective default if undetermined for processing consistency
            const finalLanguageCode = detectedLang3 === 'und' ? 'eng' : detectedLang3;
            console.log(`[MediaService] Detected language (Top Guess ISO 639-3): ${detectedLang3}, Using for processing: ${finalLanguageCode}`);
            // Prepare metadata (optional title)
            const metadata = {};
            if (data.title) {
                metadata.title = data.title;
            }
            const newSource = yield db_1.db.insert(schema_1.sources).values({
                userId: user.id,
                sourceType: 'TEXT',
                extractedText: data.text,
                languageCode: finalLanguageCode, // Save to dedicated column
                metadata: metadata, // Save only other metadata (like title)
                processingStatus: 'PENDING',
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
     * Handles processing of an uploaded file (Audio or PDF).
     * Uploads to storage, creates source record, and queues the appropriate processing job.
     * @param file The uploaded file object.
     * @param user The authenticated user.
     * @param languageCode Optional language code (primarily for audio transcription).
     * @returns The result containing the new source ID.
     */
    createSourceFromFileUpload(file, user, languageCode) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[MediaService] Processing file upload for user ${user.id}: ${file.originalname}, Type: ${file.mimetype}. Provided language code: ${languageCode || 'None'}`);
            let storagePath = null;
            let sourceType; // Determine source type
            let jobToEnqueue;
            let jobPayload = { sourceId: 0 }; // Initialize with placeholder
            // Determine source type and job based on mimetype
            if (file.mimetype.startsWith('audio/')) {
                sourceType = 'AUDIO';
                jobToEnqueue = job_definition_1.JobType.PROCESS_AUDIO_TRANSCRIPTION;
            }
            else if (file.mimetype === 'application/pdf') {
                sourceType = 'PDF';
                jobToEnqueue = job_definition_1.JobType.PROCESS_PDF;
            }
            else if (file.mimetype.startsWith('image/')) {
                sourceType = 'IMAGE';
                jobToEnqueue = job_definition_1.JobType.PROCESS_IMAGE;
            }
            else {
                // Now only rejects truly unsupported types
                yield fs.unlink(file.path); // Clean up temp file
                throw new Error(`Unsupported file type: ${file.mimetype}`);
            }
            // Use provided language code or default to 'eng' (ISO 639-3) - Primarily for Audio
            // PDF language detection happens in its dedicated job
            const finalLanguageCode = languageCode || 'eng';
            try {
                // 1. Construct storage path (e.g., user_123/{audio|pdf|image}/timestamp_filename.ext)
                const timestamp = Date.now();
                const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
                let folder = 'unknown';
                if (sourceType === 'AUDIO')
                    folder = 'audio';
                else if (sourceType === 'PDF')
                    folder = 'pdf';
                else if (sourceType === 'IMAGE')
                    folder = 'images';
                storagePath = `user_${user.id}/${folder}/${timestamp}_${safeFilename}`;
                // 2. Upload to Supabase Storage
                console.log(`[MediaService] Uploading ${sourceType} to Supabase: ${storagePath}`);
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
                    console.error(`[MediaService] Failed to delete local temp file ${file.path}:`, unlinkError);
                }
                // 4. Create source record in DB
                const newSourceData = {
                    userId: user.id,
                    sourceType: sourceType,
                    originalFilename: file.originalname,
                    originalStoragePath: storagePath,
                    processingStatus: 'PENDING',
                    metadata: { storagePath }, // Keep storagePath in metadata for now
                };
                // Add language code only if it's relevant initially (i.e., for Audio)
                if (sourceType === 'AUDIO') {
                    newSourceData.languageCode = finalLanguageCode;
                } // PDF & Image language is determined later (or irrelevant for image)
                const newSource = yield db_1.db.insert(schema_1.sources).values(newSourceData).returning({ id: schema_1.sources.id });
                if (!newSource || newSource.length === 0) {
                    throw new Error('Failed to create source record after upload');
                }
                const createdSource = newSource[0];
                jobPayload.sourceId = createdSource.id; // Set the actual source ID
                console.log(`[MediaService] Source record created for ${sourceType} upload with ID: ${createdSource.id}`);
                // Add language code to payload if it's an audio job
                if (jobToEnqueue === job_definition_1.JobType.PROCESS_AUDIO_TRANSCRIPTION) {
                    jobPayload.languageCode = finalLanguageCode;
                }
                // 5. Enqueue the appropriate job
                yield queue_1.noteProcessingQueue.add(jobToEnqueue, jobPayload);
                console.log(`[MediaService] Enqueued ${jobToEnqueue} job for source ID: ${createdSource.id}${sourceType === 'AUDIO' ? ', Language: ' + finalLanguageCode : ''}`);
                return {
                    sourceId: createdSource.id,
                    message: `${sourceType} file uploaded successfully, processing initiated.`
                };
            }
            catch (error) {
                console.error(`[MediaService] Error processing ${sourceType || 'file'} upload for user ${user.id}:`, error);
                // Cleanup attempt: Delete storage file and local temp file
                if (storagePath) {
                    console.warn(`[MediaService] Attempting to clean up Supabase file due to error: ${storagePath}`);
                    try {
                        yield storage_service_1.storageService.deleteFile(storagePath);
                    }
                    catch (e) {
                        console.error('[MediaService] Error cleaning storage file:', e);
                    }
                }
                try {
                    yield fs.unlink(file.path);
                    console.log(`[MediaService] Deleted local temp file during error cleanup: ${file.path}`);
                }
                catch (cleanupError) {
                    if (cleanupError.code !== 'ENOENT') {
                        console.error(`[MediaService] Error during local file cleanup after error:`, cleanupError);
                    }
                }
                throw new Error(`Failed to process ${sourceType || 'file'} upload: ${error.message}`);
            }
        });
    }
    /**
     * Creates a Source record for a PDF from a URL and queues it for processing.
     * @param data Object containing the PDF URL.
     * @param user The authenticated user.
     * @returns The result containing the new source ID.
     */
    createSourceFromPdfUrl(data, user) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[MediaService] Processing PDF URL for user ${user.id}: ${data.url}`);
            // Basic URL validation (can be enhanced)
            try {
                zod_1.z.string().url().parse(data.url);
            }
            catch (validationError) {
                throw new Error('Invalid URL provided.');
            }
            // Create source record
            const newSource = yield db_1.db.insert(schema_1.sources).values({
                userId: user.id,
                sourceType: 'PDF',
                originalUrl: data.url, // Store the URL
                processingStatus: 'PENDING',
                metadata: { originalUrl: data.url }, // Include URL in metadata too for consistency
            }).returning({
                id: schema_1.sources.id,
            });
            if (!newSource || newSource.length === 0) {
                throw new Error('Failed to create source record for PDF URL');
            }
            const createdSource = newSource[0];
            console.log(`[MediaService] Source record created for PDF URL with ID: ${createdSource.id}`);
            // Enqueue the PDF processing job
            try {
                yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_PDF, { sourceId: createdSource.id });
                console.log(`[MediaService] Enqueued ${job_definition_1.JobType.PROCESS_PDF} job for source ID: ${createdSource.id}`);
            }
            catch (queueError) {
                console.error(`[MediaService] Failed to enqueue PDF processing job for source ID: ${createdSource.id}`, queueError);
                yield db_1.db.update(schema_1.sources)
                    .set({ processingStatus: 'FAILED', processingError: 'Failed to enqueue PDF processing job' })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, createdSource.id));
                throw new Error('Failed to start PDF processing after saving source.');
            }
            return {
                sourceId: createdSource.id,
                message: "PDF URL received, processing initiated."
            };
        });
    }
}
exports.MediaService = MediaService;
exports.mediaService = new MediaService();
