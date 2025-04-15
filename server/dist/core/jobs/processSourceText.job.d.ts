import { Job } from 'bullmq';
interface ProcessSourceTextJobData {
    sourceId: number;
}
/**
 * Job processor for handling initial text processing.
 * - Fetches source text.
 * - (Later) Calls AI service to generate structure.
 * - Updates source status.
 */
export declare function processSourceTextJob(job: Job<ProcessSourceTextJobData>): Promise<void>;
export {};
