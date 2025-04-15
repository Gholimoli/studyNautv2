import { Job } from 'bullmq';
/**
 * Handles the PROCESS_AUDIO_TRANSCRIPTION job.
 * Fetches the source, calls the transcription service, and updates status.
 */
export declare function processAudioTranscriptionJob(job: Job): Promise<void>;
