"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv = __importStar(require("dotenv"));
// Load .env file from the project root (server directory)
dotenv.config(); // Simplified call
// Import your job processor functions (create these files later)
const processSourceText_job_1 = require("./core/jobs/processSourceText.job");
const processVisualPlaceholders_job_1 = require("./core/jobs/processVisualPlaceholders.job");
const generateVisual_job_1 = require("./core/jobs/generateVisual.job");
const assembleNote_job_1 = require("./core/jobs/assembleNote.job");
const processAudioTranscription_job_1 = require("./core/jobs/processAudioTranscription.job");
const processPdf_job_1 = require("./core/jobs/processPdf.job"); // Import the new PDF job processor
const processImage_job_1 = require("./core/jobs/processImage.job"); // Import the new image job processor
// import { generateStudyToolsJob } from '@/core/jobs/generateStudyTools.job'; // Commented out - Phase 8 Task
// Import JobType enum/const
const job_definition_1 = require("./core/jobs/job.definition");
// --- Configuration --- 
const QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'note-processing';
if (!process.env.REDIS_URL) {
    console.error('Missing required environment variable: REDIS_URL');
    process.exit(1);
}
// --- Redis Connection --- 
// Use IORedis for potentially better performance and options
const redisConnection = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Prevent immediate job failures on temporary connection issues
    enableReadyCheck: false,
});
redisConnection.on('connect', () => {
    console.log(`[Worker] Connected to Redis at ${process.env.REDIS_URL}`);
});
redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
    // Optional: Implement logic to attempt reconnection or shutdown gracefully
});
// --- Worker Definition --- 
console.log(`[Worker] Initializing worker for queue: ${QUEUE_NAME}`);
const worker = new bullmq_1.Worker(QUEUE_NAME, (job) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`[Worker] Processing job ${job.name} (${job.id}) with data:`, job.data);
    try {
        // Use JobType constants for comparison
        switch (job.name) {
            case job_definition_1.JobType.PROCESS_SOURCE_TEXT:
                yield (0, processSourceText_job_1.processSourceTextJob)(job);
                break;
            case job_definition_1.JobType.PROCESS_AUDIO_TRANSCRIPTION:
                yield (0, processAudioTranscription_job_1.processAudioTranscriptionJob)(job);
                break;
            case job_definition_1.JobType.PROCESS_VISUAL_PLACEHOLDERS:
                yield (0, processVisualPlaceholders_job_1.handleProcessVisualPlaceholdersJob)(job);
                break;
            case job_definition_1.JobType.GENERATE_VISUAL:
                yield (0, generateVisual_job_1.generateVisualJob)(job);
                break;
            case job_definition_1.JobType.ASSEMBLE_NOTE:
                yield (0, assembleNote_job_1.handleAssembleNoteJob)(job);
                break;
            // Add case for PROCESS_PDF
            case job_definition_1.JobType.PROCESS_PDF:
                yield (0, processPdf_job_1.processPdfJob)(job);
                break;
            // Add case for PROCESS_IMAGE
            case job_definition_1.JobType.PROCESS_IMAGE:
                yield (0, processImage_job_1.processImageJob)(job);
                break;
            // case JobType.GENERATE_STUDY_TOOLS: // Commented out - Phase 8 Task
            //   await generateStudyToolsJob(job);
            //   break;
            default:
                console.warn(`[Worker] Unknown job name: ${job.name}`);
                throw new Error(`No processor found for job name: ${job.name}`);
        }
        console.log(`[Worker] Completed job ${job.name} (${job.id})`);
    }
    catch (error) {
        console.error(`[Worker] Failed job ${job.name} (${job.id}) with error:`, error);
        // Important: Throw the error so BullMQ knows the job failed
        throw error;
    }
}), {
    connection: redisConnection.duplicate(), // Use a duplicated connection for the worker
    concurrency: parseInt(process.env.BULLMQ_CONCURRENCY || '5', 10),
    limiter: {
        max: parseInt(process.env.BULLMQ_RATE_LIMIT_MAX || '100', 10), // Max 100 jobs
        duration: parseInt(process.env.BULLMQ_RATE_LIMIT_DURATION || '1000', 10), // per 1000ms (1 second)
    }
    // Add other worker options if needed (e.g., autorun: true is default)
});
// --- Event Listeners (Optional but Recommended) --- 
worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.name} (${job.id}) completed.`);
});
worker.on('failed', (job, error) => {
    // Job might be undefined if the error happened before processing started
    console.error(`[Worker] Job ${job === null || job === void 0 ? void 0 : job.name} (${job === null || job === void 0 ? void 0 : job.id}) failed with error: ${error.message}`, error.stack);
});
worker.on('error', (error) => {
    console.error('[Worker] Worker encountered an error:', error);
});
worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} has stalled.`);
});
console.log('[Worker] Worker instance created. Waiting for jobs...');
// --- Graceful Shutdown --- 
function shutdown() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[Worker] Shutting down...');
        yield worker.close();
        yield redisConnection.quit();
        console.log('[Worker] Shutdown complete.');
        process.exit(0);
    });
}
// Wrap async shutdown call in a sync handler
process.on('SIGINT', () => {
    shutdown().catch(err => {
        console.error('[Worker] Error during SIGINT shutdown:', err);
        process.exit(1);
    });
});
process.on('SIGTERM', () => {
    shutdown().catch(err => {
        console.error('[Worker] Error during SIGTERM shutdown:', err);
        process.exit(1);
    });
});
