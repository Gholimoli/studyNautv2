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
// Load .env variables from the server directory root
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
const QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'note-processing';
const REDIS_URL = process.env.REDIS_URL;
// Read Job ID from command-line argument
const JOB_ID_TO_DELETE = process.argv[2];
if (!JOB_ID_TO_DELETE) {
    console.error('Usage: ts-node delete-job.ts <JOB_ID>');
    process.exit(1);
}
if (!REDIS_URL) {
    console.error('Missing required environment variable: REDIS_URL');
    process.exit(1);
}
const redisConnection = new ioredis_1.default(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
const queue = new bullmq_1.Queue(QUEUE_NAME, { connection: redisConnection });
function deleteJob() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Attempting to delete job ID ${JOB_ID_TO_DELETE} from queue ${QUEUE_NAME}...`);
        try {
            const job = yield bullmq_1.Job.fromId(queue, JOB_ID_TO_DELETE);
            if (!job) {
                console.warn(`Job ${JOB_ID_TO_DELETE} not found. Nothing to delete.`);
                return;
            }
            const currentState = yield job.getState();
            console.log(`Current state of job ${JOB_ID_TO_DELETE}: ${currentState}`);
            console.log(`Removing job ${JOB_ID_TO_DELETE}...`);
            yield job.remove(); // Remove the job completely
            console.log(`Job ${JOB_ID_TO_DELETE} successfully removed.`);
            // Verify removal
            const jobAfterRemove = yield bullmq_1.Job.fromId(queue, JOB_ID_TO_DELETE);
            if (!jobAfterRemove) {
                console.log(`Verification successful: Job ${JOB_ID_TO_DELETE} no longer exists.`);
            }
            else {
                console.warn(`Verification failed: Job ${JOB_ID_TO_DELETE} still exists after removal attempt.`);
            }
        }
        catch (error) {
            console.error(`Error processing job ${JOB_ID_TO_DELETE}:`, error);
        }
        finally {
            // Close connections
            yield queue.close();
            yield redisConnection.quit();
            console.log('Connections closed.');
        }
    });
}
deleteJob();
