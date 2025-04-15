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
const p_limit_1 = __importDefault(require("p-limit"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const openai_processor_1 = require("./openai.processor");
const elevenlabs_utils_1 = require("./elevenlabs.utils"); // Keep local utils
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
// --- Core: Transcribe a Single Chunk (ElevenLabs) ---
function transcribeChunk(chunkPath, languageCode, startTimeOffset, attempt) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[ElevenLabsProcessor] Transcribing chunk ${path_1.default.basename(chunkPath)}, offset: ${startTimeOffset.toFixed(2)}s, attempt: ${attempt}`);
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            console.error('[ElevenLabsProcessor] ELEVENLABS_API_KEY not set.');
            return null;
        }
        const formData = new form_data_1.default();
        formData.append('file', fs_1.default.createReadStream(chunkPath));
        formData.append('model_id', 'scribe_v1'); // Corrected model ID based on API error and docs
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
            timeout: CHUNK_TIMEOUT, // Set timeout for the request
        };
        return new Promise((resolve, reject) => {
            const req = https_1.default.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                        console.error(`[ElevenLabsProcessor] Chunk ${path_1.default.basename(chunkPath)} failed. Status: ${res.statusCode}, Body: ${body.substring(0, 500)}`);
                        return reject(new Error(`Request failed with status code ${res.statusCode}`));
                    }
                    try {
                        const parsedResponse = JSON.parse(body);
                        if (!parsedResponse.words || parsedResponse.words.length === 0) {
                            console.warn(`[ElevenLabsProcessor] Chunk ${path_1.default.basename(chunkPath)} returned no words.`);
                            // Resolve with empty words rather than failing the chunk entirely
                            resolve({ chunkIndex: parseInt(path_1.default.basename(chunkPath).split('_')[1]), words: [] });
                            return;
                        }
                        // Adjust timestamps
                        const adjustedWords = parsedResponse.words.map((word) => ({
                            word: word.word,
                            start: word.start_time + startTimeOffset,
                            end: word.end_time + startTimeOffset,
                        }));
                        resolve({ chunkIndex: parseInt(path_1.default.basename(chunkPath).split('_')[1]), words: adjustedWords });
                    }
                    catch (parseError) {
                        console.error(`[ElevenLabsProcessor] Chunk ${path_1.default.basename(chunkPath)} JSON parse error:`, parseError);
                        reject(new Error('Failed to parse ElevenLabs API response'));
                    }
                });
            });
            req.on('timeout', () => {
                console.error(`[ElevenLabsProcessor] Chunk ${path_1.default.basename(chunkPath)} timed out after ${CHUNK_TIMEOUT / 1000}s.`);
                req.destroy(new Error('Request timed out'));
            });
            req.on('error', (error) => {
                console.error(`[ElevenLabsProcessor] Chunk ${path_1.default.basename(chunkPath)} request error:`, error);
                reject(error);
            });
            formData.pipe(req);
        });
    });
}
// --- Core: Process Chunks in Parallel with Retries ---
function processChunksInParallel(chunks, languageCode, resultsFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const limit = (0, p_limit_1.default)(MAX_CONCURRENT_CHUNKS);
        const permanentlyFailedChunkIndices = [];
        const resultsFileStream = fs_1.default.createWriteStream(resultsFilePath, { flags: 'a' }); // Append mode
        const tasks = chunks.map((chunk) => limit(() => __awaiter(this, void 0, void 0, function* () {
            for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
                try {
                    const result = yield transcribeChunk(chunk.path, languageCode, chunk.start, attempt);
                    if (result) {
                        // Write successful result to the JSONL file
                        resultsFileStream.write(JSON.stringify(result) + '\n');
                        console.log(`[ElevenLabsProcessor] Successfully processed chunk ${chunk.index} on attempt ${attempt}.`);
                        return; // Success, exit retry loop for this chunk
                    }
                }
                catch (error) {
                    console.warn(`[ElevenLabsProcessor] Chunk ${chunk.index} failed on attempt ${attempt}:`, error.message);
                    if (attempt === MAX_CHUNK_RETRIES) {
                        console.error(`[ElevenLabsProcessor] Chunk ${chunk.index} permanently failed after ${MAX_CHUNK_RETRIES} attempts.`);
                        permanentlyFailedChunkIndices.push(chunk.index);
                    }
                    else {
                        yield new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
                    }
                }
            }
        })));
        yield Promise.all(tasks);
        resultsFileStream.close(); // Ensure the stream is closed
        return permanentlyFailedChunkIndices;
    });
}
// --- Core: Combine Results from Different Sources ---
function combineTranscriptionsFromSources(elevenLabsResultsPath, openAIResults, allChunkIndices) {
    return __awaiter(this, void 0, void 0, function* () {
        const combinedWordsMap = new Map();
        // 1. Read ElevenLabs results if the file exists
        if (elevenLabsResultsPath && fs_1.default.existsSync(elevenLabsResultsPath)) {
            const fileContent = yield fs_1.default.promises.readFile(elevenLabsResultsPath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const result = JSON.parse(line);
                    combinedWordsMap.set(result.chunkIndex, result.words);
                }
                catch (error) {
                    console.error(`[ElevenLabsProcessor] Error parsing line from results file ${elevenLabsResultsPath}:`, line, error);
                }
            }
        }
        // 2. Overwrite with OpenAI results (OpenAI takes precedence for failed chunks)
        if (openAIResults) {
            for (const result of openAIResults) {
                combinedWordsMap.set(result.chunkIndex, result.words);
                console.log(`[ElevenLabsProcessor] Using OpenAI result for chunk ${result.chunkIndex}`);
            }
        }
        // 3. Assemble final word list in original order
        let allWords = [];
        for (const index of allChunkIndices) {
            const words = combinedWordsMap.get(index);
            if (words) {
                allWords = allWords.concat(words);
            }
            else {
                console.warn(`[ElevenLabsProcessor] Missing transcription data for chunk index ${index}.`);
                // Optionally add a placeholder word or gap indicator
            }
        }
        if (allWords.length === 0) {
            console.warn("[ElevenLabsProcessor] No words collected after combining sources.");
            // Return empty transcript with a default title instead of null
            return { title: "Empty Transcription", transcript: "", words: [] };
        }
        // 4. Sort globally by start time (essential after combining chunks)
        allWords.sort((a, b) => a.start - b.start);
        // 5. Generate final transcript string
        const finalTranscript = allWords.map(w => w.word).join(' ');
        // Use original filename or a placeholder for title
        const title = "Audio Transcription"; // Placeholder title
        return { title, transcript: finalTranscript, words: allWords };
    });
}
// --- Main Exported Function --- 
function processAudioWithElevenLabs(audioFilePath, languageCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            console.error('[ElevenLabsProcessor] ELEVENLABS_API_KEY is not configured.');
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
                // Re-use transcribeChunk logic for a single "chunk" representing the whole file
                const result = yield transcribeChunk(audioFilePath, languageCode, 0, 1);
                if (result && result.words.length > 0) {
                    const transcript = result.words.map(w => w.word).join(' ');
                    return { title: path_1.default.basename(audioFilePath), transcript: transcript, words: result.words };
                }
                else {
                    console.warn("[ElevenLabsProcessor] Direct API call returned no words.");
                    // Consider falling back to OpenAI for the whole file here?
                    // For now, return empty transcript if direct call yields nothing.
                    return { title: path_1.default.basename(audioFilePath), transcript: "", words: [] };
                }
            }
            // Scenario B: Chunking (File Size > Limit)
            console.log(`[ElevenLabsProcessor] File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) exceeds limit. Starting chunking.`);
            tempDir = yield (0, elevenlabs_utils_1.createTempDir)();
            const chunks = yield (0, elevenlabs_utils_1.createChunks)(audioFilePath, tempDir);
            if (chunks.length === 0) {
                throw new Error("Failed to create any audio chunks.");
            }
            elevenLabsResultsPath = path_1.default.join(tempDir, 'elevenlabs_results.jsonl');
            const allChunkIndices = chunks.map(c => c.index);
            console.log(`[ElevenLabsProcessor] Processing ${chunks.length} chunks in parallel...`);
            const permanentlyFailedChunkIndices = yield processChunksInParallel(chunks, languageCode, elevenLabsResultsPath);
            let openAIResults = null;
            if (permanentlyFailedChunkIndices.length > 0) {
                console.warn(`[ElevenLabsProcessor] ${permanentlyFailedChunkIndices.length} chunks failed ElevenLabs processing. Attempting OpenAI fallback.`);
                const failedChunksMetadata = chunks.filter(chunk => permanentlyFailedChunkIndices.includes(chunk.index));
                // Assuming processSpecificAudioChunksWithOpenAI exists and handles its own errors/config check
                openAIResults = yield (0, openai_processor_1.processSpecificAudioChunksWithOpenAI)(failedChunksMetadata, languageCode);
                if (!openAIResults || openAIResults.length === 0) {
                    console.warn("[ElevenLabsProcessor] OpenAI fallback did not return results for failed chunks.");
                }
            }
            console.log('[ElevenLabsProcessor] Combining results from sources...');
            return yield combineTranscriptionsFromSources(elevenLabsResultsPath, openAIResults, allChunkIndices);
        }
        catch (error) {
            console.error('[ElevenLabsProcessor] Error during audio processing pipeline:', error);
            return null; // Indicate failure
        }
        finally {
            // Cleanup temporary directory if created
            if (tempDir) {
                yield (0, elevenlabs_utils_1.cleanupTempDir)(tempDir);
            }
        }
    });
}
