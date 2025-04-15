import { Job } from 'bullmq';
import { GenerateVisualPayload } from './job.definition';
/**
 * Job processor for generating or finding a visual for a placeholder.
 * - Fetches visual details (description, query).
 * - Calls image search/generation utility.
 * - Updates visual record with URL or error.
 * - Checks if all visuals for the source are done to enqueue assembly.
 */
export declare function generateVisualJob(job: Job<GenerateVisualPayload>): Promise<void>;
