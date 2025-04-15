import { Job } from 'bullmq';
import { ProcessVisualPlaceholdersPayload } from './job.definition';
/**
 * Job processor for handling visual placeholders identified by AI.
 * - Fetches AI structure from source metadata.
 * - Creates visual records in the database.
 * - Enqueues GENERATE_VISUAL job for each.
 */
export declare function processVisualPlaceholdersJob(job: Job<ProcessVisualPlaceholdersPayload>): Promise<void>;
