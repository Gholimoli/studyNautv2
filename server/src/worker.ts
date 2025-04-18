import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from the project root (server directory)
dotenv.config(); // Simplified call

// Import your job processor functions (create these files later)
import { processSourceTextJob } from '@/core/jobs/processSourceText.job';
import { processVisualPlaceholdersJob } from '@/core/jobs/processVisualPlaceholders.job';
import { generateVisualJob } from '@/core/jobs/generateVisual.job';
import { assembleNoteJob } from '@/core/jobs/assembleNote.job';
import { processAudioTranscriptionJob } from '@/core/jobs/processAudioTranscription.job';
import { processYouTubeTranscriptionJob } from '@/core/jobs/processYouTubeTranscription.job';
import { processPdfJob } from '@/core/jobs/processPdf.job'; // Import the new PDF job processor
import { processImageJob } from '@/core/jobs/processImage.job'; // Import the new image job processor
// import { generateStudyToolsJob } from '@/core/jobs/generateStudyTools.job'; // Commented out - Phase 8 Task

// Import JobType enum/const
import { JobType } from '@/core/jobs/job.definition';

// --- Configuration --- 
const QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'note-processing';

if (!process.env.REDIS_URL) {
  console.error('Missing required environment variable: REDIS_URL');
  process.exit(1);
}

// --- Redis Connection --- 
// Use IORedis for potentially better performance and options
const redisConnection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Prevent immediate job failures on temporary connection issues
  enableReadyCheck: false,
});

redisConnection.on('connect', () => {
  console.log(`[Worker] Connected to Redis at ${process.env.REDIS_URL}`);
});

redisConnection.on('error', (err: Error) => {
  console.error('Redis connection error:', err);
  // Optional: Implement logic to attempt reconnection or shutdown gracefully
});

// --- Worker Definition --- 

console.log(`[Worker] Initializing worker for queue: ${QUEUE_NAME}`);

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    console.log(`[Worker] Processing job ${job.name} (${job.id}) with data:`, job.data);
    try {
      // Use JobType constants for comparison
      switch (job.name) {
        case JobType.PROCESS_SOURCE_TEXT:
          await processSourceTextJob(job);
          break;
        case JobType.PROCESS_AUDIO_TRANSCRIPTION:
          await processAudioTranscriptionJob(job);
          break;
        case JobType.PROCESS_VISUAL_PLACEHOLDERS:
          await processVisualPlaceholdersJob(job);
          break;
        case JobType.GENERATE_VISUAL:
          await generateVisualJob(job);
          break;
        case JobType.ASSEMBLE_NOTE:
          await assembleNoteJob(job);
          break;
        // Add case for PROCESS_PDF
        case JobType.PROCESS_PDF:
          await processPdfJob(job);
          break;
        // Add case for PROCESS_IMAGE
        case JobType.PROCESS_IMAGE:
          await processImageJob(job);
          break;
        // case JobType.GENERATE_STUDY_TOOLS: // Commented out - Phase 8 Task
        //   await generateStudyToolsJob(job);
        //   break;
        default:
          console.warn(`[Worker] Unknown job name: ${job.name}`);
          throw new Error(`No processor found for job name: ${job.name}`);
      }
      console.log(`[Worker] Completed job ${job.name} (${job.id})`);
    } catch (error) {
      console.error(`[Worker] Failed job ${job.name} (${job.id}) with error:`, error);
      // Important: Throw the error so BullMQ knows the job failed
      throw error;
    }
  },
  {
    connection: redisConnection.duplicate(), // Use a duplicated connection for the worker
    concurrency: parseInt(process.env.BULLMQ_CONCURRENCY || '5', 10),
    limiter: {
        max: parseInt(process.env.BULLMQ_RATE_LIMIT_MAX || '100', 10), // Max 100 jobs
        duration: parseInt(process.env.BULLMQ_RATE_LIMIT_DURATION || '1000', 10), // per 1000ms (1 second)
    }
    // Add other worker options if needed (e.g., autorun: true is default)
  }
);

// --- Event Listeners (Optional but Recommended) --- 

worker.on('completed', (job: Job, result: any) => {
  console.log(`[Worker] Job ${job.name} (${job.id}) completed.`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  // Job might be undefined if the error happened before processing started
  console.error(`[Worker] Job ${job?.name} (${job?.id}) failed with error: ${error.message}`, error.stack);
});

worker.on('error', (error: Error) => {
  console.error('[Worker] Worker encountered an error:', error);
});

worker.on('stalled', (jobId: string) => {
    console.warn(`[Worker] Job ${jobId} has stalled.`);
});

console.log('[Worker] Worker instance created. Waiting for jobs...');

// --- Graceful Shutdown --- 

async function shutdown() {
  console.log('[Worker] Shutting down...');
  await worker.close();
  await redisConnection.quit();
  console.log('[Worker] Shutdown complete.');
  process.exit(0);
}

// Wrap async shutdown call in a sync handler
process.on('SIGINT', () => {
  shutdown().catch(err => {
    console.error('[Worker] Error during SIGINT shutdown:', err);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown().catch(err => {
    console.error('[Worker] Error during SIGTERM shutdown:', err);
    process.exit(1);
  });
}); 