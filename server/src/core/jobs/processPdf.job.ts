import { Job } from 'bullmq';
import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { JobPayload, JobType } from './job.definition';
import { noteProcessingQueue } from './queue';
import { ocrService } from '@/modules/ocr/ocr.service'; // Import the actual OCR service
import { storageService } from '@/core/services/storage.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
// Import the multer module itself
import multer from 'multer';

/**
 * Job processor for PDF files using the dedicated OCR service.
 * Downloads the PDF, calls the OCR service, updates the source,
 * and enqueues the next processing job.
 */
export async function processPdfJob(job: Job<JobPayload['PROCESS_PDF']>) {
    const { sourceId } = job.data;
    console.log(`[Worker: PROCESS_PDF] Starting job for source ID: ${sourceId} using OCR Service.`);

    let tempLocalPath: string | null = null;
    let sourceRecord;

    try {
        // 1. Fetch source record
        sourceRecord = await db.query.sources.findFirst({
            where: eq(sources.id, sourceId),
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
        await db.update(sources)
                .set({ processingStatus: 'PROCESSING', processingStage: 'PDF_DOWNLOADING' })
                .where(eq(sources.id, sourceId));

        // 3. Download file to temporary location
        const tempFilename = `${Date.now()}-${path.basename(storagePath)}`;
        tempLocalPath = path.join(os.tmpdir(), tempFilename);
        console.log(`[Worker: PROCESS_PDF] Downloading ${storagePath} from storage to ${tempLocalPath}`);
        await storageService.downloadFile(storagePath, tempLocalPath);
        console.log(`[Worker: PROCESS_PDF] File ready at: ${tempLocalPath}`);
        
        // Create a mock Multer file object for the OcrService
        // Use 'as any' to bypass the persistent type resolution issue
        const mockFile: any = { // Use type assertion 'any'
            path: tempLocalPath!,
            originalname: originalFilename,
            mimetype: mimetype,
            fieldname: 'file', 
            encoding: '', 
            size: (await fs.stat(tempLocalPath!)).size, 
            stream: null as any, 
            destination: '', 
            filename: '', 
            buffer: null as any, 
        };

        // 4. Call OCR Service
        await db.update(sources).set({ processingStage: 'PDF_OCR_IN_PROGRESS' }).where(eq(sources.id, sourceId));
        console.log(`[Worker: PROCESS_PDF] Calling OCR Service for file: ${mockFile.originalname}`);
        const ocrResult = await ocrService.processFile(mockFile, 'pdf');
        const extractedText = ocrResult.text;
        const providerUsed = ocrResult.provider; // Track provider (Mistral/Fallback)
        console.log(`[Worker: PROCESS_PDF] OCR successful. Provider: ${providerUsed}`);

        if (!extractedText) {
            console.warn(`[Worker: PROCESS_PDF] OCR Service returned empty text for source ${sourceId}.`);
            // Decide if empty text is an error or just processed
        }

        // 5. Update source record with extracted text & provider
        await db.update(sources)
                .set({ 
                    extractedText: extractedText || '', 
                    processingStatus: 'PENDING', 
                    processingStage: 'AI_ANALYSIS_PENDING', 
                    processingError: null,
                    metadata: {
                        ...(sourceRecord.metadata as object || {}),
                        ocrProvider: providerUsed // Store which provider was used
                    }
                })
                .where(eq(sources.id, sourceId));
        
        console.log(`[Worker: PROCESS_PDF] Successfully updated source ${sourceId} after OCR.`);

        // 6. Enqueue the next job (PROCESS_SOURCE_TEXT)
        await noteProcessingQueue.add(JobType.PROCESS_SOURCE_TEXT, { sourceId });
        console.log(`[Worker: PROCESS_PDF] Enqueued ${JobType.PROCESS_SOURCE_TEXT} job for source ID: ${sourceId}`);

    } catch (error) {
        console.error(`[Worker: PROCESS_PDF] Error processing source ${sourceId} via OCR Service:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF OCR error';
        try {
            await db.update(sources)
                .set({ 
                    processingStatus: 'FAILED', 
                    processingStage: sourceRecord?.processingStage || 'PDF_OCR_FAILED', 
                    processingError: errorMessage
                })
                .where(eq(sources.id, sourceId));
        } catch (dbError) {
            console.error(`[Worker: PROCESS_PDF] Failed to update source ${sourceId} status to FAILED after OCR error:`, dbError);
        }
        throw error; 
    } finally {
        // 7. Cleanup temp file
        if (tempLocalPath) {
            try {
                await fs.unlink(tempLocalPath);
                console.log(`[Worker: PROCESS_PDF] Deleted temporary local file: ${tempLocalPath}`);
            } catch (cleanupError) {
                console.error(`[Worker: PROCESS_PDF] Failed to delete temporary local file ${tempLocalPath}:`, cleanupError);
            }
        }
    }
} 