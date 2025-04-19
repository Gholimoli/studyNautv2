import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import * as dotenv from 'dotenv';

// Load .env variables from the server directory root
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'note-processing';
const REDIS_URL = process.env.REDIS_URL;
// Read Job ID from command-line argument
const JOB_ID_TO_RETRY = process.argv[2]; 

if (!JOB_ID_TO_RETRY) {
    console.error('Usage: ts-node retry-job.ts <JOB_ID>');
    process.exit(1);
}

if (!REDIS_URL) {
  console.error('Missing required environment variable: REDIS_URL');
  process.exit(1);
}

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const queue = new Queue(QUEUE_NAME, { connection: redisConnection });

async function retryFailedJob() {
  console.log(`Attempting to retry job ID ${JOB_ID_TO_RETRY} in queue ${QUEUE_NAME}...`);

  try {
    const job = await Job.fromId(queue, JOB_ID_TO_RETRY);

    if (!job) {
      console.error(`Job ${JOB_ID_TO_RETRY} not found.`);
      return;
    }

    const currentState = await job.getState();
    console.log(`Current state of job ${JOB_ID_TO_RETRY}: ${currentState}`);

    if (currentState === 'failed') {
      console.log(`Refetching job ${JOB_ID_TO_RETRY} before retry...`);
      const freshJob = await Job.fromId(queue, JOB_ID_TO_RETRY);
      if (!freshJob) {
          console.error(`Failed to refetch job ${JOB_ID_TO_RETRY} before retry.`);
          return;
      }
      console.log(`Retrying job ${JOB_ID_TO_RETRY}...`);
      await freshJob.retry();
      console.log(`Job ${JOB_ID_TO_RETRY} successfully sent retry command.`);
      const jobAfterRetry = await Job.fromId(queue, JOB_ID_TO_RETRY);
      const newState = jobAfterRetry ? await jobAfterRetry.getState() : 'unknown';
      console.log(`New state of job ${JOB_ID_TO_RETRY}: ${newState}`);
    } else {
      console.log(`Job ${JOB_ID_TO_RETRY} is not in 'failed' state (current state: ${currentState}). No retry needed or possible via this method.`);
    }

  } catch (error) {
    console.error(`Error processing job ${JOB_ID_TO_RETRY}:`, error);
  } finally {
    // Close connections
    await queue.close();
    await redisConnection.quit();
    console.log('Connections closed.');
  }
}

retryFailedJob(); 