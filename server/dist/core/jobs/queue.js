"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noteProcessingQueue = exports.NOTE_PROCESSING_QUEUE = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.NOTE_PROCESSING_QUEUE = 'note-processing';
// Create the main queue instance
exports.noteProcessingQueue = new bullmq_1.Queue(exports.NOTE_PROCESSING_QUEUE, {
    connection: redis_1.redisConnectionOptions,
    defaultJobOptions: {
        attempts: 3, // Number of attempts before marking job as failed
        backoff: {
            type: 'exponential',
            delay: 1000, // Initial delay 1s
        },
        removeOnComplete: { age: 3600 }, // Keep completed jobs for 1 hour
        removeOnFail: false, // Keep failed jobs indefinitely for inspection
    },
});
exports.noteProcessingQueue.on('error', (error) => {
    console.error(`[BullMQ:${exports.NOTE_PROCESSING_QUEUE}] Queue Error:`, error);
});
console.log(`[BullMQ] Initialized queue: ${exports.NOTE_PROCESSING_QUEUE}`);
