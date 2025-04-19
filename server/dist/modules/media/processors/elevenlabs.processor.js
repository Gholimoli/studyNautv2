"use strict";
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
exports.processAudioWithElevenLabs = processAudioWithElevenLabs;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const openai_processor_1 = require("./openai.processor");
const elevenlabs_utils_1 = require("./elevenlabs.utils"); // Import from utils
const config_1 = require("../../../core/config/config"); // Import validated config
// --- Constants (Adjust as needed) ---
const FILE_SIZE_LIMIT_FOR_CHUNKING = 25 * 1024 * 1024; // 25 MB
const MAX_CONCURRENT_CHUNKS = 12;
const MAX_CHUNK_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const CHUNK_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const TARGET_CHUNK_DURATION_SECONDS = 300; // Aim for 5-minute chunks
const MIN_CHUNK_DURATION_SECONDS = 10;
const MAX_CHUNK_DURATION_SECONDS = 600;
const CHUNK_SIZE_MB = 5; // Target chunk size for splitting
// --- Main Exported Function --- 
function processAudioWithElevenLabs(audioFilePath, languageCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = config_1.config.ai.elevenlabsApiKey;
        if (!apiKey) {
            console.error('[ElevenLabsProcessor] ELEVENLABS_API_KEY is not configured in config.');
            return null;
        }
        let tempDir;
        let elevenLabsResultsPath = null;
        try {
            const stats = yield fs_1.default.promises.stat(audioFilePath);
            const fileSize = stats.size;
            // Scenario A: Direct API Call (File Size <= Limit)
            if (fileSize <= FILE_SIZE_LIMIT_FOR_CHUNKING) {
                console.log(`[ElevenLabsProcessor] File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) within limit. Using direct API call.`);
                // Call the utility function directly
                const result = yield (0, elevenlabs_utils_1.transcribeChunk)(audioFilePath, languageCode, 0, 1);
                if (result && result.words.length > 0) {
                    const transcript = result.words.map((w) => w.word).join(' ');
                    return { title: path_1.default.basename(audioFilePath), transcript: transcript, words: result.words };
                }
                else {
                    console.warn("[ElevenLabsProcessor] Direct API call returned no words or failed.");
                    // Return empty transcript if direct call yields nothing useful
                    return { title: path_1.default.basename(audioFilePath), transcript: "", words: [] };
                }
            }
            // Scenario B: Chunking (File Size > Limit)
            console.log(`[ElevenLabsProcessor] File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) exceeds limit. Starting chunking.`);
            tempDir = yield (0, elevenlabs_utils_1.createTempDir)(); // Use util
            const chunks = yield (0, elevenlabs_utils_1.createChunks)(audioFilePath, tempDir); // Use util
            if (chunks.length === 0) {
                throw new Error("Failed to create any audio chunks.");
            }
            elevenLabsResultsPath = path_1.default.join(tempDir, 'elevenlabs_results.jsonl');
            const allChunkIndices = chunks.map(c => c.index);
            console.log(`[ElevenLabsProcessor] Processing ${chunks.length} chunks in parallel...`);
            // Call the utility function
            const permanentlyFailedChunkIndices = yield (0, elevenlabs_utils_1.processChunksInParallel)(chunks, languageCode, elevenLabsResultsPath);
            let openAIResults = null; // Initialize as null
            if (permanentlyFailedChunkIndices.length > 0) {
                console.warn(`[ElevenLabsProcessor] ${permanentlyFailedChunkIndices.length} chunks failed ElevenLabs processing. Attempting OpenAI fallback.`);
                const failedChunksMetadata = chunks.filter(chunk => permanentlyFailedChunkIndices.includes(chunk.index));
                // Assuming processSpecificAudioChunksWithOpenAI handles its own errors/config check
                openAIResults = yield (0, openai_processor_1.processSpecificAudioChunksWithOpenAI)(failedChunksMetadata, languageCode);
                if (!openAIResults || openAIResults.length === 0) {
                    console.warn("[ElevenLabsProcessor] OpenAI fallback did not return results for failed chunks.");
                }
            }
            console.log('[ElevenLabsProcessor] Combining results from sources...');
            // Call the utility function
            return yield (0, elevenlabs_utils_1.combineTranscriptionsFromSources)(elevenLabsResultsPath, openAIResults, allChunkIndices);
        }
        catch (error) {
            console.error('[ElevenLabsProcessor] Error during audio processing pipeline:', error);
            return null; // Indicate failure
        }
        finally {
            // Cleanup temporary directory if created
            if (tempDir) {
                yield (0, elevenlabs_utils_1.cleanupTempDir)(tempDir); // Use util
            }
        }
    });
}
