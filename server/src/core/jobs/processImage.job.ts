import { Job } from 'bullmq';
import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { storageService } from '@/core/services/storage.service';
import { ocrService } from '@/modules/ocr/ocr.service';
import { ProcessImagePayload, JobType } from './job.definition';
import { noteProcessingQueue } from './queue';
import { AppError } from '@/core/errors/app.error';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export async function processImageJob(job: Job<ProcessImagePayload>) {
    const { sourceId } = job.data;
    console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Starting job for source ID: ${sourceId}`);

    let tempFilePath: string | null = null;
    let source;

    try {
        // 1. Get source details
        source = await db.query.sources.findFirst({
            where: eq(sources.id, sourceId),
        });

        if (!source) {
            throw new Error(`Source record not found for ID: ${sourceId}`);
        }
        if (source.processingStatus === 'COMPLETED') {
            console.warn(`[Worker: ${JobType.PROCESS_IMAGE}] Source ${sourceId} is already completed. Skipping.`);
            return;
        }
        if (!source.originalStoragePath) {
            throw new Error(`Source ${sourceId} is missing originalStoragePath.`);
        }

        // Update status to PROCESSING
        await db.update(sources)
            .set({ processingStatus: 'PROCESSING', processingStage: 'OCR_IMAGE' })
            .where(eq(sources.id, sourceId));
        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Source ${sourceId} status updated to PROCESSING.`);

        // 2. Download image file from storage to a temporary location
        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Downloading image from: ${source.originalStoragePath}`);
        // Generate a unique temporary file path
        const tempDir = os.tmpdir();
        const uniqueFilename = `${Date.now()}-${sourceId}-${path.basename(source.originalStoragePath || 'image.tmp')}`;
        tempFilePath = path.join(tempDir, uniqueFilename);
        
        // Call the correct download method
        await storageService.downloadFile(source.originalStoragePath, tempFilePath);
        
        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Image downloaded to temporary path: ${tempFilePath}`);

        // 3. Perform OCR using OcrService
        // Construct a mock Multer file object for the OcrService
        const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: source.originalFilename || 'image.tmp',
            encoding: '',
            // Determine mimetype from path or source record (if available)
            // For simplicity, let's try to infer or use a default. A better way
            // would be to store mimetype in the source record during upload.
            mimetype: determineMimeType(source.originalStoragePath) || 'image/png', // Default or infer
            size: 0, // Size isn't critical for OCR service here, but could get from fs.stat
            stream: null as any, // Not needed by OcrService
            destination: '', // Not needed
            filename: '', // Not needed
            path: tempFilePath, // Use renamed variable
            buffer: null as any // Not needed as OcrService reads from path
        };

        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Calling OcrService.processFile for source ${sourceId}`);
        const ocrResult = await ocrService.processFile(mockFile, 'image');
        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] OCR successful. Provider: ${ocrResult.provider}`);

        // 4. Update source with extracted text
        await db.update(sources)
            .set({ 
                extractedText: ocrResult.text,
                processingStatus: 'PENDING', // Ready for next stage
                processingStage: 'STRUCTURE_GENERATION',
                metadata: { 
                    ...(source.metadata || {}), 
                    ocrProvider: ocrResult.provider,
                    // Potentially add other OCR meta if available
                } 
            })
            .where(eq(sources.id, sourceId));
        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Source ${sourceId} updated with extracted text.`);

        // 5. Enqueue next job (PROCESS_SOURCE_TEXT)
        await noteProcessingQueue.add(JobType.PROCESS_SOURCE_TEXT, { sourceId });
        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Enqueued ${JobType.PROCESS_SOURCE_TEXT} job for source ${sourceId}.`);

    } catch (error: unknown) {
        console.error(`[Worker: ${JobType.PROCESS_IMAGE}] Error processing job for source ${sourceId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during image processing';
        // Update source status to FAILED
        if (sourceId) { // Check if sourceId was available
            await db.update(sources)
                .set({ processingStatus: 'FAILED', processingError: errorMessage, processingStage: 'OCR_IMAGE' })
                .where(eq(sources.id, sourceId));
        }
        // Re-throw the error so BullMQ knows the job failed
        throw error;
    } finally {
        // Cleanup the temporary file if it was created
        if (tempFilePath) {
            console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Cleaning up temporary file: ${tempFilePath}`);
            try {
                await fs.unlink(tempFilePath);
            } catch (unlinkError: any) {
                // Log error but don't throw from finally block
                if (unlinkError.code !== 'ENOENT') { // Ignore if file already gone
                    console.error(`[Worker: ${JobType.PROCESS_IMAGE}] Error deleting temp file ${tempFilePath}:`, unlinkError);
                }
            }
        }
        console.log(`[Worker: ${JobType.PROCESS_IMAGE}] Finished job for source ID: ${sourceId}`);
    }
}

// Helper to crudely determine mimetype from filename extension
// NOTE: This is basic. Using a library like 'mime-types' or storing
// the mimetype during upload is more reliable.
function determineMimeType(filePath: string): string | null {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        // Add other mappings if needed
        default: return null;
    }
} 