import { Job } from 'bullmq';
export declare const processAudioTranscription: (job: Job<{
    sourceId: number;
    audioFilePath: string;
    languageCode?: string;
}>) => Promise<void>;
