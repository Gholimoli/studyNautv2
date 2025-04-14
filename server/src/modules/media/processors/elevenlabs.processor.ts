import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import pLimit from 'p-limit';
import FormData from 'form-data'; // Needs installation: pnpm add form-data
import { TranscriptData, ElevenLabsTranscriptionResponse, OpenAIWord } from '@shared/types/transcript.types'; // Assuming shared types
import { processSpecificAudioChunksWithOpenAI } from './openai.processor'; // Assumes openai.processor.ts exists

const execAsync = promisify(exec);

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

interface ChunkMetadata {
  path: string;
  index: number;
  start: number;
  end: number;
}

interface TranscriptionResult {
  chunkIndex: number;
  words: OpenAIWord[]; // Using OpenAIWord as a common structure for adjusted words
}

// --- Helper: Create Temporary Directory ---
async function createTempDir(): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `studynaut-chunks-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// --- Helper: Cleanup Temporary Directory ---
async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
    console.log(`[ElevenLabsProcessor] Cleaned up temp directory: ${dirPath}`);
  } catch (error) {
    console.error(`[ElevenLabsProcessor] Error cleaning up temp directory ${dirPath}:`, error);
  }
}

// --- Helper: Get Audio Duration --- 
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    // ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 <file>
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration)) {
      throw new Error('ffprobe did not return a valid number for duration');
    }
    return duration;
  } catch (error) {
    console.error(`[ElevenLabsProcessor] Error getting duration for ${filePath}:`, error);
    throw new Error(`Failed to get audio duration using ffprobe: ${(error as Error).message}`);
  }
}

// --- Helper: Create Audio Chunks --- 
async function createChunks(audioFilePath: string, tempDir: string): Promise<ChunkMetadata[]> {
  const fileSize = (await fs.promises.stat(audioFilePath)).size;
  const duration = await getAudioDuration(audioFilePath);
  const chunks: ChunkMetadata[] = [];
  let currentPosition = 0;

  // Calculate estimated chunk duration based on target size, clamped
  const estimatedBytesPerSecond = fileSize / duration;
  let chunkDuration = (CHUNK_SIZE_MB * 1024 * 1024) / estimatedBytesPerSecond;
  chunkDuration = Math.max(MIN_CHUNK_DURATION_SECONDS, Math.min(MAX_CHUNK_DURATION_SECONDS, chunkDuration));
  
  console.log(`[ElevenLabsProcessor] Splitting file (${(fileSize / 1024 / 1024).toFixed(2)} MB, ${duration.toFixed(2)}s) into chunks of ~${chunkDuration.toFixed(2)}s`);

  let chunkIndex = 0;
  while (currentPosition < duration) {
    const startTime = currentPosition;
    const endTime = Math.min(currentPosition + chunkDuration, duration);
    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}.m4a`); // Assume output matches input format or is compatible

    // ffmpeg -i <input> -ss <start> -to <end> -c copy <output>
    const command = `ffmpeg -i "${audioFilePath}" -ss ${startTime} -to ${endTime} -c copy -y "${chunkPath}"`;
    try {
      await execAsync(command);
      chunks.push({ path: chunkPath, index: chunkIndex, start: startTime, end: endTime });
      console.log(`[ElevenLabsProcessor] Created chunk ${chunkIndex}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
    } catch (error) {
        console.error(`[ElevenLabsProcessor] Error creating chunk ${chunkIndex}:`, error);
        // Decide if we should throw or continue with potentially missing chunks
        throw new Error(`Failed to create audio chunk ${chunkIndex} using ffmpeg: ${(error as Error).message}`);
    }

    currentPosition = endTime;
    chunkIndex++;
    // Safety break for potential infinite loops
    if (chunkIndex > 1000) { 
        console.error("[ElevenLabsProcessor] Exceeded maximum chunk limit (1000). Aborting chunk creation.");
        throw new Error("Exceeded maximum chunk limit during audio splitting.");
    }
  }

  return chunks;
}

// --- Core: Transcribe a Single Chunk (ElevenLabs) ---
async function transcribeChunk(chunkPath: string, languageCode: string | undefined, startTimeOffset: number, attempt: number): Promise<TranscriptionResult | null> {
  console.log(`[ElevenLabsProcessor] Transcribing chunk ${path.basename(chunkPath)}, offset: ${startTimeOffset.toFixed(2)}s, attempt: ${attempt}`);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[ElevenLabsProcessor] ELEVENLABS_API_KEY not set.');
    return null;
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(chunkPath));
  formData.append('model_id', 'scribe_v1'); // Corrected model ID based on API error and docs
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
    timeout: CHUNK_TIMEOUT, // Set timeout for the request
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            console.error(`[ElevenLabsProcessor] Chunk ${path.basename(chunkPath)} failed. Status: ${res.statusCode}, Body: ${body.substring(0, 500)}`);
            return reject(new Error(`Request failed with status code ${res.statusCode}`));
        }
        try {
          const parsedResponse = JSON.parse(body) as ElevenLabsTranscriptionResponse;
          if (!parsedResponse.words || parsedResponse.words.length === 0) {
            console.warn(`[ElevenLabsProcessor] Chunk ${path.basename(chunkPath)} returned no words.`);
            // Resolve with empty words rather than failing the chunk entirely
            resolve({ chunkIndex: parseInt(path.basename(chunkPath).split('_')[1]), words: [] }); 
            return;
          }
          // Adjust timestamps
          const adjustedWords: OpenAIWord[] = parsedResponse.words.map((word: { word: string; start_time: number; end_time: number; }) => ({
            word: word.word,
            start: word.start_time + startTimeOffset,
            end: word.end_time + startTimeOffset,
          }));
          resolve({ chunkIndex: parseInt(path.basename(chunkPath).split('_')[1]), words: adjustedWords });
        } catch (parseError) {
            console.error(`[ElevenLabsProcessor] Chunk ${path.basename(chunkPath)} JSON parse error:`, parseError);
            reject(new Error('Failed to parse ElevenLabs API response'));
        }
      });
    });

    req.on('timeout', () => {
        console.error(`[ElevenLabsProcessor] Chunk ${path.basename(chunkPath)} timed out after ${CHUNK_TIMEOUT / 1000}s.`);
        req.destroy(new Error('Request timed out'));
    });

    req.on('error', (error) => {
        console.error(`[ElevenLabsProcessor] Chunk ${path.basename(chunkPath)} request error:`, error);
        reject(error);
    });

    formData.pipe(req);
  });
}

// --- Core: Process Chunks in Parallel with Retries ---
async function processChunksInParallel(chunks: ChunkMetadata[], languageCode: string | undefined, resultsFilePath: string): Promise<number[]> {
  const limit = pLimit(MAX_CONCURRENT_CHUNKS);
  const permanentlyFailedChunkIndices: number[] = [];
  const resultsFileStream = fs.createWriteStream(resultsFilePath, { flags: 'a' }); // Append mode

  const tasks = chunks.map((chunk) => limit(async () => {
    for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      try {
        const result = await transcribeChunk(chunk.path, languageCode, chunk.start, attempt);
        if (result) {
           // Write successful result to the JSONL file
           resultsFileStream.write(JSON.stringify(result) + '\n');
           console.log(`[ElevenLabsProcessor] Successfully processed chunk ${chunk.index} on attempt ${attempt}.`);
           return; // Success, exit retry loop for this chunk
        }
      } catch (error) {
        console.warn(`[ElevenLabsProcessor] Chunk ${chunk.index} failed on attempt ${attempt}:`, (error as Error).message);
        if (attempt === MAX_CHUNK_RETRIES) {
          console.error(`[ElevenLabsProcessor] Chunk ${chunk.index} permanently failed after ${MAX_CHUNK_RETRIES} attempts.`);
          permanentlyFailedChunkIndices.push(chunk.index);
        } else {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
        }
      }
    }
  }));

  await Promise.all(tasks);
  resultsFileStream.close(); // Ensure the stream is closed
  return permanentlyFailedChunkIndices;
}

// --- Core: Combine Results from Different Sources ---
async function combineTranscriptionsFromSources(
    elevenLabsResultsPath: string | null,
    openAIResults: TranscriptionResult[] | null,
    allChunkIndices: number[]
  ): Promise<TranscriptData | null> {
    const combinedWordsMap = new Map<number, OpenAIWord[]>();
  
    // 1. Read ElevenLabs results if the file exists
    if (elevenLabsResultsPath && fs.existsSync(elevenLabsResultsPath)) {
      const fileContent = await fs.promises.readFile(elevenLabsResultsPath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        try {
          const result = JSON.parse(line) as TranscriptionResult;
          combinedWordsMap.set(result.chunkIndex, result.words);
        } catch (error) {
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
    let allWords: OpenAIWord[] = [];
    for (const index of allChunkIndices) {
      const words = combinedWordsMap.get(index);
      if (words) {
        allWords = allWords.concat(words);
      } else {
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
  }

// --- Main Exported Function --- 
export async function processAudioWithElevenLabs(audioFilePath: string, languageCode?: string): Promise<TranscriptData | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[ElevenLabsProcessor] ELEVENLABS_API_KEY is not configured.');
    return null;
  }

  let tempDir: string | undefined;
  let elevenLabsResultsPath: string | null = null;

  try {
    const stats = await fs.promises.stat(audioFilePath);
    const fileSize = stats.size;

    // Scenario A: Direct API Call (File Size <= Limit)
    if (fileSize <= FILE_SIZE_LIMIT_FOR_CHUNKING) {
      console.log(`[ElevenLabsProcessor] File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) within limit. Using direct API call.`);
      // Re-use transcribeChunk logic for a single "chunk" representing the whole file
      const result = await transcribeChunk(audioFilePath, languageCode, 0, 1);
      if (result && result.words.length > 0) {
        const transcript = result.words.map(w => w.word).join(' ');
        return { title: path.basename(audioFilePath), transcript: transcript, words: result.words };
      } else {
         console.warn("[ElevenLabsProcessor] Direct API call returned no words.");
         // Consider falling back to OpenAI for the whole file here?
         // For now, return empty transcript if direct call yields nothing.
         return { title: path.basename(audioFilePath), transcript: "", words: [] }; 
      }
    }

    // Scenario B: Chunking (File Size > Limit)
    console.log(`[ElevenLabsProcessor] File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) exceeds limit. Starting chunking.`);
    tempDir = await createTempDir();
    const chunks = await createChunks(audioFilePath, tempDir);
    if (chunks.length === 0) {
        throw new Error("Failed to create any audio chunks.");
    }
    
    elevenLabsResultsPath = path.join(tempDir, 'elevenlabs_results.jsonl');
    const allChunkIndices = chunks.map(c => c.index);

    console.log(`[ElevenLabsProcessor] Processing ${chunks.length} chunks in parallel...`);
    const permanentlyFailedChunkIndices = await processChunksInParallel(chunks, languageCode, elevenLabsResultsPath);

    let openAIResults: TranscriptionResult[] | null = null;
    if (permanentlyFailedChunkIndices.length > 0) {
      console.warn(`[ElevenLabsProcessor] ${permanentlyFailedChunkIndices.length} chunks failed ElevenLabs processing. Attempting OpenAI fallback.`);
      const failedChunksMetadata = chunks.filter(chunk => permanentlyFailedChunkIndices.includes(chunk.index));
      // Assuming processSpecificAudioChunksWithOpenAI exists and handles its own errors/config check
      openAIResults = await processSpecificAudioChunksWithOpenAI(failedChunksMetadata, languageCode);
       if (!openAIResults || openAIResults.length === 0) {
            console.warn("[ElevenLabsProcessor] OpenAI fallback did not return results for failed chunks.");
        }
    }

    console.log('[ElevenLabsProcessor] Combining results from sources...');
    return await combineTranscriptionsFromSources(elevenLabsResultsPath, openAIResults, allChunkIndices);

  } catch (error) {
    console.error('[ElevenLabsProcessor] Error during audio processing pipeline:', error);
    return null; // Indicate failure
  } finally {
    // Cleanup temporary directory if created
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
} 