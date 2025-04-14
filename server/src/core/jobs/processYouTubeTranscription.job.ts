import { Job } from 'bullmq';
import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { noteProcessingQueue } from './queue';
import { getYouTubeTranscript } from '@/modules/media/utils/youtubeTranscript';

export async function processYouTubeTranscriptionJob(job: Job<{ sourceId: number }>): Promise<void> {
  const { sourceId } = job.data;
  if (!sourceId || typeof sourceId !== 'number') {
    console.error(`[YouTubeJob] Invalid sourceId:`, sourceId);
    throw new Error('Invalid sourceId in job data');
  }
  let source;
  try {
    // 1. Fetch the source record
    const sourceResult = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
    if (!sourceResult || sourceResult.length === 0) {
      throw new Error(`Source record not found for ID: ${sourceId}`);
    }
    source = sourceResult[0];
    if (source.sourceType !== 'YOUTUBE' || !source.originalUrl) {
      throw new Error(`Source ${sourceId} is not a YOUTUBE type or missing originalUrl.`);
    }
    // 2. Update status to PROCESSING
    await db.update(sources)
      .set({ processingStatus: 'PROCESSING', processingStage: 'TRANSCRIPTION_IN_PROGRESS' })
      .where(eq(sources.id, sourceId));
    // 3. Fetch transcript
    let transcriptSegments;
    try {
      transcriptSegments = await getYouTubeTranscript(source.originalUrl);
    } catch (err: any) {
      await db.update(sources)
        .set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION_FAILED', processingError: err.message || 'Failed to fetch YouTube transcript' })
        .where(eq(sources.id, sourceId));
      throw err;
    }
    if (!transcriptSegments || transcriptSegments.length === 0) {
      throw new Error('Transcript extraction returned no segments.');
    }
    // 4. Combine transcript text
    const transcriptText = transcriptSegments.map(seg => seg.text).join(' ');
    // 5. Update source with transcript and metadata
    await db.update(sources)
      .set({
        extractedText: transcriptText,
        metadata: {
          ...(source.metadata || {}),
          transcript: transcriptSegments,
        },
        processingStatus: 'PENDING', // Ready for next stage
        processingStage: 'AI_ANALYSIS_PENDING',
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));
    // 6. Enqueue next job
    await noteProcessingQueue.add('PROCESS_SOURCE_TEXT', { sourceId });
    console.log(`[YouTubeJob] Successfully processed YouTube transcript for sourceId: ${sourceId}`);
  } catch (error) {
    console.error(`[YouTubeJob] Failed for sourceId: ${sourceId}`, error);
    // Error status already set above if transcript fetch failed
    if (source && (!source.processingStatus || source.processingStatus !== 'FAILED')) {
      await db.update(sources)
        .set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION_FAILED', processingError: (error as Error).message })
        .where(eq(sources.id, sourceId));
    }
    throw error;
  }
} 