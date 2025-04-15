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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTempDir = createTempDir;
exports.cleanupTempDir = cleanupTempDir;
exports.createChunks = createChunks;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const audio_utils_1 = require("../../../utils/audio.utils");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const CHUNK_SIZE_MB = 5;
const MIN_CHUNK_DURATION_SECONDS = 10;
const MAX_CHUNK_DURATION_SECONDS = 600;
/**
 * Create a temporary directory for chunk files.
 */
function createTempDir() {
    return __awaiter(this, void 0, void 0, function* () {
        const tempDir = path.join(os.tmpdir(), `studynaut-chunks-${Date.now()}`);
        yield fs.promises.mkdir(tempDir, { recursive: true });
        return tempDir;
    });
}
/**
 * Recursively remove a temporary directory.
 */
function cleanupTempDir(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs.promises.rm(dirPath, { recursive: true, force: true });
            console.log(`[ElevenLabsUtils] Cleaned up temp directory: ${dirPath}`);
        }
        catch (error) {
            console.error(`[ElevenLabsUtils] Error cleaning up temp directory ${dirPath}:`, error);
        }
    });
}
/**
 * Split an audio file into chunks of approximately CHUNK_SIZE_MB, clamped to min/max duration.
 */
function createChunks(audioFilePath, tempDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileSize = (yield fs.promises.stat(audioFilePath)).size;
        const duration = yield (0, audio_utils_1.getAudioDuration)(audioFilePath);
        // Calculate estimated chunk duration based on target size, clamped
        const estimatedBytesPerSecond = fileSize / duration;
        let chunkDuration = (CHUNK_SIZE_MB * 1024 * 1024) / estimatedBytesPerSecond;
        chunkDuration = Math.max(MIN_CHUNK_DURATION_SECONDS, Math.min(MAX_CHUNK_DURATION_SECONDS, chunkDuration));
        console.log(`[ElevenLabsUtils] Calculated target chunk duration: ${chunkDuration.toFixed(2)}s`);
        try {
            const chunksMetadata = yield (0, audio_utils_1.createAudioChunks)(audioFilePath, tempDir, chunkDuration);
            return chunksMetadata;
        }
        catch (error) {
            console.error("[ElevenLabsUtils] Error creating chunks using audio.utils:", error);
            throw error;
        }
    });
}
