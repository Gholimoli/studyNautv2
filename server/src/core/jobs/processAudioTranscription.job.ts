import { Job } from 'bullmq';
import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import { processAudioWithElevenLabs } from '@/modules/media/processors/elevenlabs.processor'; // Import the processor
import { noteProcessingQueue } from '@/core/jobs/queue'; // Import the queue
// import { mediaService } from '@/modules/media/media.service'; // Assuming you have a mediaService instance

// Define a type for the expected metadata structure
interface SourceMetadata {
  storagePath?: string;
  languageCode?: string;
  // Add other potential metadata fields here
}

/**
 * Handles the PROCESS_AUDIO_TRANSCRIPTION job.
 * Fetches the source, calls the transcription service, and updates status.
 */
export async function processAudioTranscriptionJob(job: Job): Promise<void> {
  const { sourceId } = job.data;

  if (!sourceId || typeof sourceId !== 'number') {
    console.error(`[Job ${job.id}] Invalid sourceId provided:`, sourceId);
    throw new Error('Invalid sourceId in job data');
  }

  console.log(`[Job ${job.id}] Starting PROCESS_AUDIO_TRANSCRIPTION for sourceId: ${sourceId}`);

  let source;
  try {
    // 1. Fetch the source record
    const sourceResult = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
    if (!sourceResult || sourceResult.length === 0) {
      throw new Error(`Source record not found for ID: ${sourceId}`);
    }
    source = sourceResult[0];

    if (source.sourceType !== 'AUDIO') {
      throw new Error(`Source ${sourceId} is not an AUDIO type.`);
    }

    // 2. Update status to PROCESSING
    await db.update(sources)
      .set({ processingStatus: 'PROCESSING', processingStage: 'TRANSCRIPTION_IN_PROGRESS' })
      .where(eq(sources.id, sourceId));
    console.log(`[Job ${job.id}] Updated source ${sourceId} status to PROCESSING`);

    // 3. Get the audio file path (This needs refinement based on how paths are stored/resolved)
    // The route handler saved it relative to the project root (e.g., uploads/audio/1/...). 
    // We need the absolute path here, or adjust the media service to handle relative paths.
    // ** Placeholder: Assume metadata stores the relative path **
    const metadata = source.metadata as SourceMetadata | null;

    const relativePath = metadata?.storagePath;
    if (!relativePath) {
        throw new Error(`Storage path missing in metadata for source ${sourceId}`);
    }
    const absoluteFilePath = path.resolve(__dirname, '../../..', relativePath); // Adjust relative path calculation
    const languageCode = metadata?.languageCode;

    // 4. Call the actual transcription service (using MediaService or directly)
    console.log(`[Job ${job.id}] Calling transcription service for file: ${absoluteFilePath}`);
    
    // --- Replace simulation with actual call --- 
    const transcriptResult = await processAudioWithElevenLabs(absoluteFilePath, languageCode);

    if (!transcriptResult || !transcriptResult.transcript) {
      throw new Error('Transcription failed or returned empty result.');
    }
    console.log(`[Job ${job.id}] Transcription successful. Transcript length: ${transcriptResult.transcript.length}`);
    // --- End Replace --- 

    // 5. Update status and store transcript
    // The transcription service itself might update the final text in the source record.
    // Here, we just mark the transcription stage as done.
    // The next job (PROCESS_SOURCE_TEXT) will handle AI analysis.
    await db.update(sources)
      .set({ 
          processingStatus: 'PENDING', // Reset to PENDING for the next stage
          processingStage: 'AI_ANALYSIS_PENDING',
          extractedText: transcriptResult.transcript, // Store the full transcript
          // Store word timestamps if needed, potentially in metadata
          metadata: { 
              ...metadata, // Preserve existing metadata
              wordTimestamps: transcriptResult.words, // Store word timestamps if available
              transcriptionProvider: 'elevenlabs' // Track which provider succeeded (adjust if fallback used)
            }
      })
      .where(eq(sources.id, sourceId));
    console.log(`[Job ${job.id}] Updated source ${sourceId} with transcript and status for AI Analysis`);

    // 6. Enqueue the next job (e.g., PROCESS_SOURCE_TEXT)
    await noteProcessingQueue.add('PROCESS_SOURCE_TEXT', { sourceId });
    console.log(`[Job ${job.id}] Enqueued PROCESS_SOURCE_TEXT job for sourceId: ${sourceId}`);

  } catch (error) {
    console.error(`[Job ${job.id}] Failed PROCESS_AUDIO_TRANSCRIPTION for sourceId: ${sourceId}`, error);
    // Update status to FAILED
    try {
      await db.update(sources)
        .set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION_FAILED', processingError: (error as Error).message })
        .where(eq(sources.id, sourceId));
    } catch (dbError) {
      console.error(`[Job ${job.id}] Failed to update source ${sourceId} status to FAILED after error:`, dbError);
    }
    // Re-throw the error so BullMQ marks the job as failed
    throw error; 
  }
} 