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
exports.processAudioTranscription = void 0;
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const p_limit_1 = __importDefault(require("p-limit"));
const openai_1 = __importDefault(require("openai"));
const queue_1 = require("./queue");
const job_definition_1 = require("./job.definition");
const node_fetch_1 = __importDefault(require("node-fetch"));
const form_data_1 = __importDefault(require("form-data"));
const stream_1 = require("stream");
const audio_utils_1 = require("../../utils/audio.utils");
const storage_service_1 = require("../services/storage.service");
const https_1 = __importDefault(require("https"));
// --- Constants (adjust as needed) ---
const FILE_SIZE_LIMIT_DIRECT_API = 25 * 1024 * 1024; // 25MB
const SEGMENT_TIME_SECONDS = 600; // 10 minutes, consistent with default in createAudioChunks
const MAX_CONCURRENT_CHUNKS_ELEVENLABS = 12;
const MAX_CONCURRENT_CHUNKS_OPENAI = 5;
const MAX_CHUNK_RETRIES = 3;
const RETRY_DELAY = 5000; // ms
const CHUNK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in ms for ElevenLabs chunk API call
// --- Helper Functions (Placeholders - Implement based on guide) ---
function transcribeDirectElevenLabs(filePath, languageCode) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[TranscribeJob] Attempting direct ElevenLabs transcription for ${filePath}`);
        if (!process.env.ELEVENLABS_API_KEY) {
            console.error('[TranscribeJob] ElevenLabs API key not configured.');
            return null;
        }
        const url = 'https://api.elevenlabs.io/v1/speech-to-text';
        const headers = {
            'Accept': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
        };
        try {
            const fileBuffer = yield promises_1.default.readFile(filePath);
            const form = new form_data_1.default();
            form.append('file', stream_1.Readable.from(fileBuffer), path_1.default.basename(filePath)); // Use stream
            form.append('model_id', 'scribe_v1'); // Use the specified model
            form.append('timestamps_granularity', 'word');
            form.append('diarize', 'false');
            if (languageCode) {
                form.append('language_code', languageCode);
            }
            // Set timeout for the request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT);
            const response = yield (0, node_fetch_1.default)(url, {
                method: 'POST',
                headers: Object.assign(Object.assign({}, headers), form.getHeaders()), // Include form-data headers
                body: form,
                signal: controller.signal, // Type assertion needed for AbortSignal
            });
            clearTimeout(timeoutId); // Clear timeout if fetch completes
            if (!response.ok) {
                const errorBody = yield response.text();
                console.error(`[TranscribeJob] ElevenLabs API error (${response.status}): ${errorBody}`);
                throw new Error(`ElevenLabs API request failed with status ${response.status}`);
            }
            const result = yield response.json();
            if (!result || !result.words || result.words.length === 0) {
                console.warn('[TranscribeJob] ElevenLabs response missing words data.');
                // Return transcript even if words are missing, if available
                if (result.transcript) {
                    return {
                        transcript: result.transcript,
                        processor: 'ElevenLabs'
                    };
                }
                return null;
            }
            // Format words to our WordTimestamp interface
            const words = result.words.map(w => ({
                word: w.word,
                start: w.start_time,
                end: w.end_time,
            }));
            return {
                transcript: result.transcript,
                words: words,
                processor: 'ElevenLabs',
            };
        }
        catch (error) {
            if (error.name === 'AbortError') {
                console.error('[TranscribeJob] ElevenLabs API call timed out.');
            }
            else {
                console.error('[TranscribeJob] Error during direct ElevenLabs transcription:', error);
            }
            return null; // Indicate failure
        }
    });
}
function transcribeChunkElevenLabs(chunkPath, startTimeOffset, languageCode) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[TranscribeJob] Transcribing chunk (ElevenLabs): ${chunkPath} with offset ${startTimeOffset}`);
        if (!process.env.ELEVENLABS_API_KEY) {
            console.error('[TranscribeJob] ElevenLabs API key not configured.');
            return null;
        }
        const url = 'https://api.elevenlabs.io/v1/speech-to-text';
        const headers = {
            'Accept': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
        };
        try {
            const fileBuffer = yield promises_1.default.readFile(chunkPath);
            const form = new form_data_1.default();
            form.append('file', stream_1.Readable.from(fileBuffer), path_1.default.basename(chunkPath));
            form.append('model_id', 'scribe_v1');
            form.append('timestamps_granularity', 'word');
            form.append('diarize', 'false');
            if (languageCode) {
                form.append('language_code', languageCode);
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT);
            const response = yield (0, node_fetch_1.default)(url, {
                method: 'POST',
                headers: Object.assign(Object.assign({}, headers), form.getHeaders()),
                body: form,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorBody = yield response.text();
                console.error(`[TranscribeJob] ElevenLabs chunk API error (${response.status}) for ${chunkPath}: ${errorBody}`);
                // Don't throw here, let the retry logic handle it
                return null;
            }
            const result = yield response.json();
            if (!result || !result.words || result.words.length === 0) {
                console.warn(`[TranscribeJob] ElevenLabs chunk response missing words data for ${chunkPath}.`);
                return null; // Consider success if transcript exists? No, need words for combining.
            }
            // Adjust timestamps by adding the offset
            const words = result.words.map(w => ({
                word: w.word,
                start: w.start_time + startTimeOffset,
                end: w.end_time + startTimeOffset,
            }));
            return { words }; // Return only the adjusted words for this chunk
        }
        catch (error) {
            if (error.name === 'AbortError') {
                console.error(`[TranscribeJob] ElevenLabs chunk API call timed out for ${chunkPath}.`);
            }
            else {
                console.error(`[TranscribeJob] Error during ElevenLabs chunk transcription for ${chunkPath}:`, error);
            }
            return null; // Indicate failure for retry logic
        }
    });
}
function transcribeChunksOpenAI(chunksToProcess, languageCode) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[TranscribeJob] Transcribing ${chunksToProcess.length} chunks with OpenAI fallback`);
        if (!process.env.OPENAI_API_KEY) {
            console.error('[TranscribeJob] OpenAI API key not configured for fallback.');
            return [];
        }
        const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
        const limit = (0, p_limit_1.default)(MAX_CONCURRENT_CHUNKS_OPENAI);
        const results = [];
        const transcriptionPromises = chunksToProcess.map((chunk) => limit(() => __awaiter(this, void 0, void 0, function* () {
            console.log(`[TranscribeJob] Processing chunk ${chunk.index} with OpenAI fallback: ${chunk.path}`);
            try {
                // Use the standard fs module for createReadStream
                const fileStream = fs_1.default.createReadStream(chunk.path);
                const transcription = yield openai.audio.transcriptions.create({
                    file: fileStream,
                    model: 'whisper-1',
                    language: languageCode,
                    response_format: 'verbose_json',
                    timestamp_granularities: ['word'],
                });
                // Cast to expected verbose structure - use with caution, validate if possible
                const verboseResponse = transcription;
                if (!verboseResponse.words || verboseResponse.words.length === 0) {
                    console.warn(`[TranscribeJob] OpenAI fallback response for chunk ${chunk.index} missing words data.`);
                    return; // Skip this chunk if no word data
                }
                // Adjust timestamps
                const adjustedWords = verboseResponse.words.map(w => ({
                    word: w.word,
                    start: w.start + chunk.start, // Add original chunk start time
                    end: w.end + chunk.start, // Add original chunk start time
                }));
                results.push({ chunkIndex: chunk.index, words: adjustedWords });
                console.log(`[TranscribeJob] Successfully transcribed chunk ${chunk.index} with OpenAI.`);
            }
            catch (error) {
                console.error(`[TranscribeJob] OpenAI fallback transcription failed for chunk ${chunk.index} (${chunk.path}):`, error.message || error);
                // Optionally track failed chunks here too, though combine logic might handle missing entries
            }
        })));
        yield Promise.all(transcriptionPromises);
        console.log(`[TranscribeJob] OpenAI fallback processing finished. ${results.length} chunks successfully processed.`);
        return results;
    });
}
function combineTranscriptions(elevenLabsResultsPath, openAIResults, allChunkIndices) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[TranscribeJob] Combining transcription results...');
        const combinedWordsMap = new Map();
        let processorUsed = 'ElevenLabs'; // Default
        // 1. Read ElevenLabs results from the temporary JSONL file
        try {
            const fileContent = yield promises_1.default.readFile(elevenLabsResultsPath, 'utf-8');
            const lines = fileContent.trim().split('\n');
            for (const line of lines) {
                if (line) {
                    const result = JSON.parse(line);
                    combinedWordsMap.set(result.chunkIndex, result.words);
                }
            }
        }
        catch (err) {
            // If the file doesn't exist (e.g., no ElevenLabs chunks succeeded), it's okay if OpenAI handled them.
            if (err.code !== 'ENOENT') {
                console.error('[TranscribeJob] Error reading ElevenLabs results file:', err);
                // Depending on requirements, we might proceed if OpenAI results exist, or fail here.
            }
        }
        // 2. Merge OpenAI results, overwriting any ElevenLabs results for the same chunk index
        if (openAIResults.length > 0) {
            processorUsed = 'OpenAI'; // Mark as OpenAI if fallback was used for any chunk
            for (const result of openAIResults) {
                combinedWordsMap.set(result.chunkIndex, result.words);
            }
        }
        // 3. Assemble the final word list in the original order of chunks
        let allWords = [];
        for (const index of allChunkIndices) {
            const wordsForChunk = combinedWordsMap.get(index);
            if (wordsForChunk) {
                allWords = allWords.concat(wordsForChunk);
            }
            else {
                console.warn(`[TranscribeJob] Missing transcription data for chunk index: ${index}`);
                // Decide how to handle missing chunks - fail, skip, insert placeholder?
                // For now, we just skip it.
            }
        }
        if (allWords.length === 0) {
            console.error('[TranscribeJob] No words collected after combining transcriptions.');
            return null; // Failed to get any transcription data
        }
        // 4. Sort the combined words globally by start time
        allWords.sort((a, b) => a.start - b.start);
        // 5. Generate the final transcript string
        const finalTranscript = allWords.map(w => w.word).join(' ');
        console.log(`[TranscribeJob] Combined transcription successful. Total words: ${allWords.length}`);
        return {
            transcript: finalTranscript,
            words: allWords,
            processor: processorUsed, // Indicate if fallback was involved
        };
    });
}
function transcribeFullFallbackOpenAI(filePath, languageCode) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[TranscribeJob] Attempting full fallback transcription with OpenAI for ${filePath}`);
        if (!process.env.OPENAI_API_KEY) {
            console.error('[TranscribeJob] OpenAI API key not configured for fallback.');
            return null;
        }
        try {
            const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
            // Use createReadStream for potentially large files
            const fileStream = fs_1.default.createReadStream(filePath);
            console.log(`[TranscribeJob] Calling OpenAI full fallback transcription API...`);
            const transcription = yield openai.audio.transcriptions.create({
                file: fileStream,
                model: 'whisper-1', // Using whisper-1 as the primary model for fallback transcription
                language: languageCode,
                response_format: 'text', // Request plain text, no timestamps needed
            });
            // The response type for 'text' format is just a string
            const transcriptText = transcription;
            if (!transcriptText || typeof transcriptText !== 'string') {
                console.error('[TranscribeJob] OpenAI full fallback returned invalid data type.');
                return null;
            }
            console.log(`[TranscribeJob] OpenAI full fallback transcription successful.`);
            return {
                transcript: transcriptText.trim(),
                // No words data expected or needed from this fallback
                processor: 'OpenAI',
            };
        }
        catch (error) {
            console.error(`[TranscribeJob] Error during OpenAI full fallback transcription:`, error.message || error);
            return null;
        }
    });
}
function downloadFile(url, destPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const file = fs_1.default.createWriteStream(destPath);
            https_1.default.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download file: Status Code ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`[TranscribeJob] Downloaded file to ${destPath}`);
                    resolve();
                });
            }).on('error', (err) => {
                promises_1.default.unlink(destPath).catch(e => console.error("Error deleting partial download:", e)); // Delete partial file on error
                reject(err);
            });
        });
    });
}
// --- Main Job Processor ---
const processAudioTranscription = (job) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Directly use the storagePath passed in job data
    const { sourceId, audioFilePath: storagePath, languageCode } = job.data;
    console.log(`[TranscribeJob] Starting transcription for source ${sourceId}, storagePath: ${storagePath}`);
    // Ensure storagePath from job data is valid before proceeding
    if (!storagePath || typeof storagePath !== 'string') {
        console.error(`[TranscribeJob] Invalid or missing storagePath in job data for source ${sourceId}:`, storagePath);
        yield index_1.db.update(schema_1.sources).set({
            processingStatus: 'FAILED',
            processingStage: 'TRANSCRIPTION_ERROR',
            processingError: 'Invalid storage path received in job data'
        }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
        // Throw error to mark job as failed
        throw new Error(`Invalid storage path in job data for source ${sourceId}`);
    }
    // **NEW**: Download file from Supabase to a local temp path
    let localTempFilePath;
    let localTempDir;
    try {
        // Update status immediately (before download)
        yield index_1.db.update(schema_1.sources).set({ processingStatus: 'PROCESSING', processingStage: 'DOWNLOADING' }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
        yield job.updateProgress(5); // Progress: Starting Download
        // 1. Get Signed URL
        const signedUrl = yield storage_service_1.storageService.getSignedUrl(storagePath);
        // 2. Create local temporary file path
        localTempDir = yield promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), `studynaut-transcribe-${sourceId}-`));
        const originalExtension = path_1.default.extname(storagePath); // Get extension from original path
        localTempFilePath = path_1.default.join(localTempDir, `audio${originalExtension}`);
        console.log(`[TranscribeJob] Created temp dir: ${localTempDir}, temp file path: ${localTempFilePath}`);
        // 3. Download File
        yield downloadFile(signedUrl, localTempFilePath);
        console.log(`[TranscribeJob] Successfully downloaded audio from Supabase to ${localTempFilePath}`);
        // --- Original logic starts here, using localTempFilePath --- 
        yield job.updateProgress(10); // Progress: Starting
        const fileSize = yield (0, audio_utils_1.checkFileSize)(localTempFilePath);
        let transcriptData = null;
        let chunkingPerformed = false;
        // Determine transcription strategy
        if (fileSize <= FILE_SIZE_LIMIT_DIRECT_API) {
            // Attempt Direct ElevenLabs API
            console.log('[TranscribeJob] File size within limit, attempting direct ElevenLabs API.');
            transcriptData = yield transcribeDirectElevenLabs(localTempFilePath, languageCode);
        }
        else {
            // Chunking needed
            console.log('[TranscribeJob] File size exceeds limit, chunking required.');
            chunkingPerformed = true;
            // Reuse localTempDir for chunks
            const chunks = yield (0, audio_utils_1.createAudioChunks)(localTempFilePath, localTempDir, SEGMENT_TIME_SECONDS);
            yield job.updateProgress(20); // Progress: Chunking done
            if (chunks.length === 0) {
                throw new Error('createAudioChunks did not return any chunks.');
            }
            const elevenLabsResultsPath = path_1.default.join(localTempDir, 'elevenlabs_results.jsonl');
            const allChunkIndices = chunks.map(c => c.index);
            const limit = (0, p_limit_1.default)(MAX_CONCURRENT_CHUNKS_ELEVENLABS);
            const permanentlyFailedChunkIndices = [];
            const resultsFileStream = fs_1.default.createWriteStream(elevenLabsResultsPath, { flags: 'a' });
            const chunkTasks = chunks.map((chunk, idx) => limit(() => __awaiter(void 0, void 0, void 0, function* () {
                for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
                    const result = yield transcribeChunkElevenLabs(chunk.path, chunk.start, languageCode);
                    if (result) {
                        resultsFileStream.write(JSON.stringify({ chunkIndex: chunk.index, words: result.words }) + '\n');
                        yield job.updateProgress(20 + Math.floor(60 * ((idx + 1) / chunks.length))); // Progress during chunk processing
                        return; // Success
                    }
                    if (attempt === MAX_CHUNK_RETRIES) {
                        permanentlyFailedChunkIndices.push(chunk.index);
                    }
                    else {
                        yield new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    }
                }
            })));
            yield Promise.all(chunkTasks);
            resultsFileStream.close();
            yield job.updateProgress(80); // Progress: ElevenLabs chunking done
            let openAIResults = [];
            if (permanentlyFailedChunkIndices.length > 0) {
                console.log(`[TranscribeJob] ${permanentlyFailedChunkIndices.length} chunks failed ElevenLabs, attempting OpenAI fallback.`);
                const failedChunks = chunks.filter(c => permanentlyFailedChunkIndices.includes(c.index));
                openAIResults = yield transcribeChunksOpenAI(failedChunks, languageCode);
                yield job.updateProgress(85); // Progress: OpenAI fallback attempt done
            }
            transcriptData = yield combineTranscriptions(elevenLabsResultsPath, openAIResults, allChunkIndices);
        }
        // Fallback to Full OpenAI if Primary failed
        if (!transcriptData) {
            console.log('[TranscribeJob] Primary transcription (ElevenLabs) failed or returned no data. Falling back to full OpenAI transcription.');
            transcriptData = yield transcribeFullFallbackOpenAI(localTempFilePath, languageCode);
            yield job.updateProgress(90); // Progress: Fallback OpenAI done
        }
        if (!transcriptData || !transcriptData.transcript) {
            throw new Error('Transcription failed using both ElevenLabs and OpenAI fallback.');
        }
        // Update Source Record
        yield index_1.db.update(schema_1.sources).set({
            extractedText: transcriptData.transcript,
            metadata: Object.assign(Object.assign({}, ((_a = (yield index_1.db.select({ metadata: schema_1.sources.metadata }).from(schema_1.sources).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId)))[0]) === null || _a === void 0 ? void 0 : _a.metadata) || {}), { languageCode: languageCode, transcriptionProcessor: transcriptData.processor, wordTimestamps: transcriptData.words // Store word timestamps if available
             }),
            processingStatus: 'COMPLETED', // Mark transcription as done
            processingStage: 'PENDING_AI_ANALYSIS', // Set next stage
            updatedAt: new Date(),
        }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
        console.log(`[TranscribeJob] Successfully transcribed source ${sourceId}. Enqueuing next job.`);
        yield job.updateProgress(100); // Progress: Complete
        // Enqueue the next job (e.g., AI analysis)
        yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_SOURCE_TEXT, { sourceId });
    }
    catch (error) {
        console.error(`[TranscribeJob] Failed to process transcription for source ${sourceId}:`, error);
        yield index_1.db.update(schema_1.sources).set({
            processingStatus: 'FAILED',
            processingError: `Transcription failed: ${error.message}`,
            updatedAt: new Date(),
        }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
        // Optionally, re-throw the error if you want the job to be marked as failed in BullMQ
        throw error;
    }
    finally {
        // **NEW**: Cleanup downloaded temporary file and directory
        if (localTempDir) {
            try {
                yield promises_1.default.rm(localTempDir, { recursive: true, force: true });
                console.log(`[TranscribeJob] Cleaned up temporary directory: ${localTempDir}`);
            }
            catch (cleanupError) {
                console.error(`[TranscribeJob] Error cleaning up temp directory ${localTempDir}:`, cleanupError);
            }
        }
    }
});
exports.processAudioTranscription = processAudioTranscription;
