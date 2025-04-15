import { Job } from 'bullmq';
import { AssembleNotePayload } from './job.definition';
/**
 * Job processor for assembling the final note content.
 */
export declare function assembleNoteJob(job: Job<AssembleNotePayload>): Promise<void>;
