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
exports.processPdfJob = processPdfJob;
const db_1 = require("../../core/db");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const job_definition_1 = require("./job.definition");
const queue_1 = require("./queue");
const ocr_service_1 = require("../../modules/ocr/ocr.service"); // Import the actual OCR service
const storage_service_1 = require("../../core/services/storage.service");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Job processor for PDF files using the dedicated OCR service.
 * Downloads the PDF, calls the OCR service, updates the source,
 * and enqueues the next processing job.
 */
function processPdfJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const { sourceId } = job.data;
        console.log(`[Worker: PROCESS_PDF] Starting job for source ID: ${sourceId} using OCR Service.`);
        let tempLocalPath = null;
        let sourceRecord;
        try {
            // 1. Fetch source record
            sourceRecord = yield db_1.db.query.sources.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
            });
            if (!sourceRecord) {
                throw new Error(`Source record not found for ID: ${sourceId}`);
            }
            const storagePath = sourceRecord.originalStoragePath;
            const originalFilename = sourceRecord.originalFilename;
            // Assuming PDF if storage path exists or ends with .pdf
            const mimetype = 'application/pdf';
            if (!storagePath) {
                // Currently, only handling PDFs uploaded via storage path
                // URL processing would need implementation here or in OcrService
                throw new Error(`Source ${sourceId} does not have a storage path for PDF processing.`);
            }
            if (!originalFilename) {
                throw new Error(`Source ${sourceId} is missing original filename.`);
            }
            // 2. Update status to PROCESSING
            yield db_1.db.update(schema_1.sources)
                .set({ processingStatus: 'PROCESSING', processingStage: 'PDF_DOWNLOADING' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            // 3. Download file to temporary location
            const tempFilename = `${Date.now()}-${path.basename(storagePath)}`;
            tempLocalPath = path.join(os.tmpdir(), tempFilename);
            console.log(`[Worker: PROCESS_PDF] Downloading ${storagePath} from storage to ${tempLocalPath}`);
            yield storage_service_1.storageService.downloadFile(storagePath, tempLocalPath);
            console.log(`[Worker: PROCESS_PDF] File ready at: ${tempLocalPath}`);
            // Create a mock Multer file object for the OcrService
            // Use 'as any' to bypass the persistent type resolution issue
            const mockFile = {
                path: tempLocalPath,
                originalname: originalFilename,
                mimetype: mimetype,
                fieldname: 'file',
                encoding: '',
                size: (yield fs.stat(tempLocalPath)).size,
                stream: null,
                destination: '',
                filename: '',
                buffer: null,
            };
            // 4. Call OCR Service
            yield db_1.db.update(schema_1.sources).set({ processingStage: 'PDF_OCR_IN_PROGRESS' }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker: PROCESS_PDF] Calling OCR Service for file: ${mockFile.originalname}`);
            const ocrResult = yield ocr_service_1.ocrService.processFile(mockFile, 'pdf');
            const extractedText = ocrResult.text;
            const providerUsed = ocrResult.provider; // Track provider (Mistral/Fallback)
            console.log(`[Worker: PROCESS_PDF] OCR successful. Provider: ${providerUsed}`);
            if (!extractedText) {
                console.warn(`[Worker: PROCESS_PDF] OCR Service returned empty text for source ${sourceId}.`);
                // Decide if empty text is an error or just processed
            }
            // 5. Update source record with extracted text & provider
            yield db_1.db.update(schema_1.sources)
                .set({
                extractedText: extractedText || '',
                processingStatus: 'PENDING',
                processingStage: 'AI_ANALYSIS_PENDING',
                processingError: null,
                metadata: Object.assign(Object.assign({}, (sourceRecord.metadata || {})), { ocrProvider: providerUsed // Store which provider was used
                 })
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker: PROCESS_PDF] Successfully updated source ${sourceId} after OCR.`);
            // 6. Enqueue the next job (PROCESS_SOURCE_TEXT)
            yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_SOURCE_TEXT, { sourceId });
            console.log(`[Worker: PROCESS_PDF] Enqueued ${job_definition_1.JobType.PROCESS_SOURCE_TEXT} job for source ID: ${sourceId}`);
        }
        catch (error) {
            console.error(`[Worker: PROCESS_PDF] Error processing source ${sourceId} via OCR Service:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown PDF OCR error';
            try {
                yield db_1.db.update(schema_1.sources)
                    .set({
                    processingStatus: 'FAILED',
                    processingStage: (sourceRecord === null || sourceRecord === void 0 ? void 0 : sourceRecord.processingStage) || 'PDF_OCR_FAILED',
                    processingError: errorMessage
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            }
            catch (dbError) {
                console.error(`[Worker: PROCESS_PDF] Failed to update source ${sourceId} status to FAILED after OCR error:`, dbError);
            }
            throw error;
        }
        finally {
            // 7. Cleanup temp file
            if (tempLocalPath) {
                try {
                    yield fs.unlink(tempLocalPath);
                    console.log(`[Worker: PROCESS_PDF] Deleted temporary local file: ${tempLocalPath}`);
                }
                catch (cleanupError) {
                    console.error(`[Worker: PROCESS_PDF] Failed to delete temporary local file ${tempLocalPath}:`, cleanupError);
                }
            }
        }
    });
}
