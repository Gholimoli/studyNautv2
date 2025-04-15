import { Queue } from 'bullmq';
export declare const NOTE_PROCESSING_QUEUE = "note-processing";
export declare const noteProcessingQueue: Queue<any, any, string, any, any, string>;
