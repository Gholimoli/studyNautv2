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
exports.processImageJob = processImageJob;
const db_1 = require("../../core/db");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const storage_service_1 = require("../../core/services/storage.service");
const ocr_service_1 = require("../../modules/ocr/ocr.service");
const job_definition_1 = require("./job.definition");
const queue_1 = require("./queue");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
function processImageJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const { sourceId } = job.data;
        console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Starting job for source ID: ${sourceId}`);
        let tempFilePath = null;
        let source;
        try {
            // 1. Get source details
            source = yield db_1.db.query.sources.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
            });
            if (!source) {
                throw new Error(`Source record not found for ID: ${sourceId}`);
            }
            if (source.processingStatus === 'COMPLETED') {
                console.warn(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Source ${sourceId} is already completed. Skipping.`);
                return;
            }
            if (!source.originalStoragePath) {
                throw new Error(`Source ${sourceId} is missing originalStoragePath.`);
            }
            // Update status to PROCESSING
            yield db_1.db.update(schema_1.sources)
                .set({ processingStatus: 'PROCESSING', processingStage: 'OCR_IMAGE' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Source ${sourceId} status updated to PROCESSING.`);
            // 2. Download image file from storage to a temporary location
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Downloading image from: ${source.originalStoragePath}`);
            // Generate a unique temporary file path
            const tempDir = os.tmpdir();
            const uniqueFilename = `${Date.now()}-${sourceId}-${path.basename(source.originalStoragePath || 'image.tmp')}`;
            tempFilePath = path.join(tempDir, uniqueFilename);
            // Call the correct download method
            yield storage_service_1.storageService.downloadFile(source.originalStoragePath, tempFilePath);
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Image downloaded to temporary path: ${tempFilePath}`);
            // 3. Perform OCR using OcrService
            // Construct a mock Multer file object for the OcrService
            const mockFile = {
                fieldname: 'file',
                originalname: source.originalFilename || 'image.tmp',
                encoding: '',
                // Determine mimetype from path or source record (if available)
                // For simplicity, let's try to infer or use a default. A better way
                // would be to store mimetype in the source record during upload.
                mimetype: determineMimeType(source.originalStoragePath) || 'image/png', // Default or infer
                size: 0, // Size isn't critical for OCR service here, but could get from fs.stat
                stream: null, // Not needed by OcrService
                destination: '', // Not needed
                filename: '', // Not needed
                path: tempFilePath, // Use renamed variable
                buffer: null // Not needed as OcrService reads from path
            };
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Calling OcrService.processFile for source ${sourceId}`);
            const ocrResult = yield ocr_service_1.ocrService.processFile(mockFile, 'image');
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] OCR successful. Provider: ${ocrResult.provider}`);
            // 4. Update source with extracted text
            yield db_1.db.update(schema_1.sources)
                .set({
                extractedText: ocrResult.text,
                processingStatus: 'PENDING', // Ready for next stage
                processingStage: 'STRUCTURE_GENERATION',
                metadata: Object.assign(Object.assign({}, (source.metadata || {})), { ocrProvider: ocrResult.provider })
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Source ${sourceId} updated with extracted text.`);
            // 5. Enqueue next job (PROCESS_SOURCE_TEXT)
            yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_SOURCE_TEXT, { sourceId });
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Enqueued ${job_definition_1.JobType.PROCESS_SOURCE_TEXT} job for source ${sourceId}.`);
        }
        catch (error) {
            console.error(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Error processing job for source ${sourceId}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during image processing';
            // Update source status to FAILED
            if (sourceId) { // Check if sourceId was available
                yield db_1.db.update(schema_1.sources)
                    .set({ processingStatus: 'FAILED', processingError: errorMessage, processingStage: 'OCR_IMAGE' })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            }
            // Re-throw the error so BullMQ knows the job failed
            throw error;
        }
        finally {
            // Cleanup the temporary file if it was created
            if (tempFilePath) {
                console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Cleaning up temporary file: ${tempFilePath}`);
                try {
                    yield fs.unlink(tempFilePath);
                }
                catch (unlinkError) {
                    // Log error but don't throw from finally block
                    if (unlinkError.code !== 'ENOENT') { // Ignore if file already gone
                        console.error(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Error deleting temp file ${tempFilePath}:`, unlinkError);
                    }
                }
            }
            console.log(`[Worker: ${job_definition_1.JobType.PROCESS_IMAGE}] Finished job for source ID: ${sourceId}`);
        }
    });
}
// Helper to crudely determine mimetype from filename extension
// NOTE: This is basic. Using a library like 'mime-types' or storing
// the mimetype during upload is more reliable.
function determineMimeType(filePath) {
    var _a;
    const extension = (_a = filePath.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    switch (extension) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        // Add other mappings if needed
        default: return null;
    }
}
