import { Queue, Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export const NOTE_PROCESSING_QUEUE = 'note-processing';

// Create the main queue instance
export const noteProcessingQueue = new Queue(NOTE_PROCESSING_QUEUE, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3, // Number of attempts before marking job as failed
    backoff: {   // Exponential backoff strategy
      type: 'exponential',
      delay: 1000, // Initial delay 1s
    },
    removeOnComplete: { age: 3600 }, // Keep completed jobs for 1 hour
    removeOnFail: false,    // Keep failed jobs indefinitely for inspection
  },
});

noteProcessingQueue.on('error', (error) => {
  console.error(`[BullMQ:${NOTE_PROCESSING_QUEUE}] Queue Error:`, error);
});

console.log(`[BullMQ] Initialized queue: ${NOTE_PROCESSING_QUEUE}`); 