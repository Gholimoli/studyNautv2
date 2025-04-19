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
exports.createTempDir = createTempDir;
exports.cleanupTempDir = cleanupTempDir;
exports.createChunks = createChunks;
exports.transcribeChunk = transcribeChunk;
exports.processChunksInParallel = processChunksInParallel;
exports.combineTranscriptionsFromSources = combineTranscriptionsFromSources;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const audio_utils_1 = require("../../../utils/audio.utils");
const https_1 = __importDefault(require("https"));
const form_data_1 = __importDefault(require("form-data"));
const p_limit_1 = __importDefault(require("p-limit"));
const config_1 = require("../../../core/config/config");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const CHUNK_SIZE_MB = 5;
const MIN_CHUNK_DURATION_SECONDS = 10;
const MAX_CHUNK_DURATION_SECONDS = 600;
const MAX_CONCURRENT_CHUNKS = 12;
const MAX_CHUNK_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const CHUNK_TIMEOUT = 10 * 60 * 1000; // 10 minutes
/**
 * Create a temporary directory for chunk files.
 */
function createTempDir() {
    return __awaiter(this, void 0, void 0, function* () {
        const tempDir = path.join(os.tmpdir(), `studynaut-chunks-${Date.now()}`);
        yield fs.promises.mkdir(tempDir, { recursive: true });
        console.log(`[ElevenLabsUtils] Created temp directory: ${tempDir}`);
        return tempDir;
    });
}
/**
 * Recursively remove a temporary directory.
 */
function cleanupTempDir(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!dirPath || !fs.existsSync(dirPath)) {
                console.log(`[ElevenLabsUtils] Temp directory already removed or path invalid: ${dirPath}`);
                return;
            }
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
        const estimatedBytesPerSecond = fileSize / duration;
        let chunkDuration = (CHUNK_SIZE_MB * 1024 * 1024) / estimatedBytesPerSecond;
        chunkDuration = Math.max(MIN_CHUNK_DURATION_SECONDS, Math.min(MAX_CHUNK_DURATION_SECONDS, chunkDuration));
        console.log(`[ElevenLabsUtils] Calculated target chunk duration: ${chunkDuration.toFixed(2)}s`);
        try {
            const chunksMetadata = yield (0, audio_utils_1.createAudioChunks)(audioFilePath, tempDir, chunkDuration);
            console.log(`[ElevenLabsUtils] Created ${chunksMetadata.length} chunks.`);
            return chunksMetadata;
        }
        catch (error) {
            console.error("[ElevenLabsUtils] Error creating chunks using audio.utils:", error);
            throw error;
        }
    });
}
/**
 * Transcribe a single audio chunk using the ElevenLabs API.
 */
function transcribeChunk(chunkPath, languageCode, startTimeOffset, attempt) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[ElevenLabsUtils] Transcribing chunk ${path.basename(chunkPath)}, offset: ${startTimeOffset.toFixed(2)}s, attempt: ${attempt}`);
        const apiKey = config_1.config.ai.elevenlabsApiKey;
        if (!apiKey) {
            console.error('[ElevenLabsUtils] ELEVENLABS_API_KEY not found in config.');
            return null; // Return null explicitly if API key is missing
        }
        const formData = new form_data_1.default();
        formData.append('file', fs.createReadStream(chunkPath));
        formData.append('model_id', 'scribe_v1');
        if (languageCode) {
            formData.append('language_code', languageCode);
        }
        formData.append('timestamps_granularity', 'word');
        formData.append('diarize', 'false');
        const options = {
            hostname: 'api.elevenlabs.io',
            path: '/v1/speech-to-text',
            method: 'POST',
            headers: Object.assign(Object.assign({}, formData.getHeaders()), { 'Accept': 'application/json', 'xi-api-key': apiKey }),
            timeout: CHUNK_TIMEOUT,
        };
        return new Promise((resolve, reject) => {
            const req = https_1.default.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                        console.error(`[ElevenLabsUtils] Chunk ${path.basename(chunkPath)} failed. Status: ${res.statusCode}, Body: ${body.substring(0, 500)}`);
                        return reject(new Error(`Request failed with status code ${res.statusCode}`));
                    }
                    try {
                        const parsedResponse = JSON.parse(body);
                        const chunkIndex = parseInt(path.basename(chunkPath).split('_')[1]); // Get index from filename
                        if (!parsedResponse.words || parsedResponse.words.length === 0) {
                            console.warn(`[ElevenLabsUtils] Chunk ${path.basename(chunkPath)} (Index ${chunkIndex}) returned no words.`);
                            resolve({ chunkIndex: chunkIndex, words: [] });
                            return;
                        }
                        const adjustedWords = parsedResponse.words.map((word) => ({
                            word: word.word,
                            start: word.start_time + startTimeOffset,
                            end: word.end_time + startTimeOffset,
                        }));
                        resolve({ chunkIndex: chunkIndex, words: adjustedWords });
                    }
                    catch (parseError) {
                        console.error(`[ElevenLabsUtils] Chunk ${path.basename(chunkPath)} JSON parse error:`, parseError);
                        reject(new Error('Failed to parse ElevenLabs API response'));
                    }
                });
            });
            req.on('timeout', () => {
                console.error(`[ElevenLabsUtils] Chunk ${path.basename(chunkPath)} timed out after ${CHUNK_TIMEOUT / 1000}s.`);
                req.destroy(new Error('Request timed out'));
            });
            req.on('error', (error) => {
                console.error(`[ElevenLabsUtils] Chunk ${path.basename(chunkPath)} request error:`, error);
                reject(error); // Reject the promise on request error
            });
            formData.pipe(req);
        });
    });
}
/**
 * Process multiple audio chunks in parallel using ElevenLabs, with retries.
 * Writes successful results to a JSONL file.
 * Returns an array of indices for chunks that permanently failed.
 */
function processChunksInParallel(chunks, languageCode, resultsFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const limit = (0, p_limit_1.default)(MAX_CONCURRENT_CHUNKS);
        const permanentlyFailedChunkIndices = [];
        // Ensure results file exists and is empty before creating write stream
        yield fs.promises.writeFile(resultsFilePath, '', { flag: 'w' });
        const resultsFileStream = fs.createWriteStream(resultsFilePath, { flags: 'a' });
        const tasks = chunks.map((chunk) => limit(() => __awaiter(this, void 0, void 0, function* () {
            let success = false;
            for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
                try {
                    const result = yield transcribeChunk(chunk.path, languageCode, chunk.start, attempt);
                    if (result) {
                        resultsFileStream.write(JSON.stringify(result) + '\n');
                        console.log(`[ElevenLabsUtils] Successfully processed chunk ${chunk.index} on attempt ${attempt}.`);
                        success = true;
                        return; // Success, exit retry loop for this chunk
                    }
                    else {
                        // If result is null (e.g., API key missing), stop retrying this chunk
                        console.warn(`[ElevenLabsUtils] Transcription attempt ${attempt} for chunk ${chunk.index} returned null. Stopping retries.`);
                        break; // Exit retry loop, chunk is considered failed
                    }
                }
                catch (error) {
                    console.warn(`[ElevenLabsUtils] Chunk ${chunk.index} failed on attempt ${attempt}:`, error.message);
                    if (attempt < MAX_CHUNK_RETRIES) {
                        yield new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
                    }
                }
            }
            // If loop finishes without success
            if (!success) {
                console.error(`[ElevenLabsUtils] Chunk ${chunk.index} permanently failed after ${MAX_CHUNK_RETRIES} attempts or early exit.`);
                permanentlyFailedChunkIndices.push(chunk.index);
            }
        })));
        try {
            yield Promise.all(tasks);
        }
        finally {
            // Ensure stream is closed
            yield new Promise((resolve, reject) => {
                resultsFileStream.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        console.log(`[ElevenLabsUtils] Parallel processing complete. Failed chunks: ${permanentlyFailedChunkIndices.length}`);
        return permanentlyFailedChunkIndices;
    });
}
/**
 * Combines transcription results from an ElevenLabs JSONL file and optional OpenAI results.
 */
function combineTranscriptionsFromSources(elevenLabsResultsPath, openAIResults, allChunkIndices) {
    return __awaiter(this, void 0, void 0, function* () {
        const combinedWordsMap = new Map();
        if (elevenLabsResultsPath && fs.existsSync(elevenLabsResultsPath)) {
            const fileContent = yield fs.promises.readFile(elevenLabsResultsPath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim() !== '');
            lines.forEach(line => {
                try {
                    const result = JSON.parse(line);
                    combinedWordsMap.set(result.chunkIndex, result.words);
                }
                catch (error) {
                    console.error(`[ElevenLabsUtils] Error parsing line from results file ${elevenLabsResultsPath}:`, line, error);
                }
            });
        }
        else if (elevenLabsResultsPath) {
            console.warn(`[ElevenLabsUtils] ElevenLabs results file not found: ${elevenLabsResultsPath}`);
        }
        if (openAIResults) {
            openAIResults.forEach(result => {
                combinedWordsMap.set(result.chunkIndex, result.words);
                console.log(`[ElevenLabsUtils] Using OpenAI result for chunk ${result.chunkIndex}`);
            });
        }
        let allWords = [];
        allChunkIndices.forEach(index => {
            const words = combinedWordsMap.get(index);
            if (words) {
                allWords = allWords.concat(words);
            }
            else {
                console.warn(`[ElevenLabsUtils] Missing transcription data for chunk index ${index}.`);
            }
        });
        if (allWords.length === 0) {
            console.warn("[ElevenLabsUtils] No words collected after combining sources.");
            return { title: "Empty Transcription", transcript: "", words: [] };
        }
        allWords.sort((a, b) => a.start - b.start);
        const finalTranscript = allWords.map(w => w.word).join(' ');
        const title = "Audio Transcription"; // Placeholder title - maybe enhance later
        console.log(`[ElevenLabsUtils] Combined transcript length: ${finalTranscript.length} chars, ${allWords.length} words.`);
        return { title, transcript: finalTranscript, words: allWords };
    });
}
