import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  createAudioChunks as createAudioChunksUtil,
  getAudioDuration as getAudioDurationUtil
} from '@/utils/audio.utils';
import https from 'https'; 
import FormData from 'form-data';
import pLimit from 'p-limit';
import { config } from '@/core/config/config';
import type { TranscriptData, ElevenLabsTranscriptionResponse, OpenAIWord } from '@shared/types/transcript.types';

const execAsync = promisify(exec);

export interface ChunkMetadata {
  path: string;
  index: number;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  chunkIndex: number;
  words: OpenAIWord[]; 
}

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
export async function createTempDir(): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `studynaut-chunks-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });
  console.log(`[ElevenLabsUtils] Created temp directory: ${tempDir}`);
  return tempDir;
}

/**
 * Recursively remove a temporary directory.
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) {
        console.log(`[ElevenLabsUtils] Temp directory already removed or path invalid: ${dirPath}`);
        return;
    }
    await fs.promises.rm(dirPath, { recursive: true, force: true });
    console.log(`[ElevenLabsUtils] Cleaned up temp directory: ${dirPath}`);
  } catch (error) {
    console.error(`[ElevenLabsUtils] Error cleaning up temp directory ${dirPath}:`, error);
  }
}

/**
 * Split an audio file into chunks of approximately CHUNK_SIZE_MB, clamped to min/max duration.
 */
export async function createChunks(audioFilePath: string, tempDir: string): Promise<ChunkMetadata[]> {
  const fileSize = (await fs.promises.stat(audioFilePath)).size;
  const duration = await getAudioDurationUtil(audioFilePath);

  const estimatedBytesPerSecond = fileSize / duration;
  let chunkDuration = (CHUNK_SIZE_MB * 1024 * 1024) / estimatedBytesPerSecond;
  chunkDuration = Math.max(MIN_CHUNK_DURATION_SECONDS, Math.min(MAX_CHUNK_DURATION_SECONDS, chunkDuration));

  console.log(`[ElevenLabsUtils] Calculated target chunk duration: ${chunkDuration.toFixed(2)}s`);

  try {
    const chunksMetadata = await createAudioChunksUtil(audioFilePath, tempDir, chunkDuration);
    console.log(`[ElevenLabsUtils] Created ${chunksMetadata.length} chunks.`);
    return chunksMetadata;
  } catch (error) {
    console.error("[ElevenLabsUtils] Error creating chunks using audio.utils:", error);
    throw error;
  }
}

/**
 * Transcribe a single audio chunk using the ElevenLabs API.
 */
export async function transcribeChunk(chunkPath: string, languageCode: string | undefined, startTimeOffset: number, attempt: number): Promise<TranscriptionResult | null> {
  console.log(`[ElevenLabsUtils] Transcribing chunk ${path.basename(chunkPath)}, offset: ${startTimeOffset.toFixed(2)}s, attempt: ${attempt}`);
  const apiKey = config.ai.elevenlabsApiKey;
  if (!apiKey) {
    console.error('[ElevenLabsUtils] ELEVENLABS_API_KEY not found in config.');
    return null; // Return null explicitly if API key is missing
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(chunkPath));
  formData.append('model_id', 'scribe_v1');
  if (languageCode) {
    formData.append('language_code', languageCode);
  }
  formData.append('timestamps_granularity', 'word');
  formData.append('diarize', 'false');

  const options: https.RequestOptions = {
    hostname: 'api.elevenlabs.io',
    path: '/v1/speech-to-text',
    method: 'POST',
    headers: {
      ...formData.getHeaders(),
      'Accept': 'application/json',
      'xi-api-key': apiKey,
    },
    timeout: CHUNK_TIMEOUT,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            console.error(`[ElevenLabsUtils] Chunk ${path.basename(chunkPath)} failed. Status: ${res.statusCode}, Body: ${body.substring(0, 500)}`);
            return reject(new Error(`Request failed with status code ${res.statusCode}`));
        }
        try {
          const parsedResponse = JSON.parse(body) as ElevenLabsTranscriptionResponse;
          const chunkIndex = parseInt(path.basename(chunkPath).split('_')[1]); // Get index from filename
          if (!parsedResponse.words || parsedResponse.words.length === 0) {
            console.warn(`[ElevenLabsUtils] Chunk ${path.basename(chunkPath)} (Index ${chunkIndex}) returned no words.`);
            resolve({ chunkIndex: chunkIndex, words: [] });
            return;
          }
          const adjustedWords: OpenAIWord[] = parsedResponse.words.map((word: { word: string; start_time: number; end_time: number; }) => ({
            word: word.word,
            start: word.start_time + startTimeOffset,
            end: word.end_time + startTimeOffset,
          }));
          resolve({ chunkIndex: chunkIndex, words: adjustedWords });
        } catch (parseError) {
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
}

/**
 * Process multiple audio chunks in parallel using ElevenLabs, with retries.
 * Writes successful results to a JSONL file.
 * Returns an array of indices for chunks that permanently failed.
 */
export async function processChunksInParallel(chunks: ChunkMetadata[], languageCode: string | undefined, resultsFilePath: string): Promise<number[]> {
  const limit = pLimit(MAX_CONCURRENT_CHUNKS);
  const permanentlyFailedChunkIndices: number[] = [];

  // Ensure results file exists and is empty before creating write stream
  await fs.promises.writeFile(resultsFilePath, '', { flag: 'w' });
  const resultsFileStream = fs.createWriteStream(resultsFilePath, { flags: 'a' });

  const tasks = chunks.map((chunk) => limit(async () => {
    let success = false;
    for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      try {
        const result = await transcribeChunk(chunk.path, languageCode, chunk.start, attempt);
        if (result) {
           resultsFileStream.write(JSON.stringify(result) + '\n');
           console.log(`[ElevenLabsUtils] Successfully processed chunk ${chunk.index} on attempt ${attempt}.`);
           success = true;
           return; // Success, exit retry loop for this chunk
        } else {
            // If result is null (e.g., API key missing), stop retrying this chunk
            console.warn(`[ElevenLabsUtils] Transcription attempt ${attempt} for chunk ${chunk.index} returned null. Stopping retries.`);
            break; // Exit retry loop, chunk is considered failed
        }
      } catch (error) {
        console.warn(`[ElevenLabsUtils] Chunk ${chunk.index} failed on attempt ${attempt}:`, (error as Error).message);
        if (attempt < MAX_CHUNK_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
        }
      }
    }
    // If loop finishes without success
    if (!success) {
        console.error(`[ElevenLabsUtils] Chunk ${chunk.index} permanently failed after ${MAX_CHUNK_RETRIES} attempts or early exit.`);
        permanentlyFailedChunkIndices.push(chunk.index);
    }
  }));

  try {
    await Promise.all(tasks);
  } finally {
    // Ensure stream is closed
    await new Promise<void>((resolve, reject) => {
        resultsFileStream.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
  }
  console.log(`[ElevenLabsUtils] Parallel processing complete. Failed chunks: ${permanentlyFailedChunkIndices.length}`);
  return permanentlyFailedChunkIndices;
}

/**
 * Combines transcription results from an ElevenLabs JSONL file and optional OpenAI results.
 */
export async function combineTranscriptionsFromSources(
    elevenLabsResultsPath: string | null,
    openAIResults: TranscriptionResult[] | null,
    allChunkIndices: number[]
  ): Promise<TranscriptData | null> {
    const combinedWordsMap = new Map<number, OpenAIWord[]>();

    if (elevenLabsResultsPath && fs.existsSync(elevenLabsResultsPath)) {
      const fileContent = await fs.promises.readFile(elevenLabsResultsPath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() !== '');
      lines.forEach(line => {
        try {
          const result = JSON.parse(line) as TranscriptionResult;
          combinedWordsMap.set(result.chunkIndex, result.words);
        } catch (error) {
          console.error(`[ElevenLabsUtils] Error parsing line from results file ${elevenLabsResultsPath}:`, line, error);
        }
      });
    } else if (elevenLabsResultsPath) {
         console.warn(`[ElevenLabsUtils] ElevenLabs results file not found: ${elevenLabsResultsPath}`);
    }

    if (openAIResults) {
      openAIResults.forEach(result => {
        combinedWordsMap.set(result.chunkIndex, result.words);
        console.log(`[ElevenLabsUtils] Using OpenAI result for chunk ${result.chunkIndex}`);
      });
    }

    let allWords: OpenAIWord[] = [];
    allChunkIndices.forEach(index => {
      const words = combinedWordsMap.get(index);
      if (words) {
        allWords = allWords.concat(words);
      } else {
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
  } 