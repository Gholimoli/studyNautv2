import { Job } from 'bullmq';
export declare function processYouTubeTranscriptionJob(job: Job<{
    sourceId: number;
}>): Promise<void>;
