import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources } from '../db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fsPromises from 'fs/promises';
import fs from 'fs';
import os from 'os';
import pLimit from 'p-limit';
import OpenAI from 'openai';
import { noteProcessingQueue } from './queue';
import { JobType } from './job.definition';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Readable } from 'stream';
import { checkFileSize, createAudioChunks } from '../../utils/audio.utils';
import { storageService } from '../services/storage.service';
import https from 'https';

// --- Constants (adjust as needed) ---
const FILE_SIZE_LIMIT_DIRECT_API = 25 * 1024 * 1024; // 25MB
const SEGMENT_TIME_SECONDS = 600; // 10 minutes, consistent with default in createAudioChunks
const MAX_CONCURRENT_CHUNKS_ELEVENLABS = 12;
const MAX_CONCURRENT_CHUNKS_OPENAI = 5;
const MAX_CHUNK_RETRIES = 3;
const RETRY_DELAY = 5000; // ms
const CHUNK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in ms for ElevenLabs chunk API call

// Define interfaces for transcript data (adapt as needed)
interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

interface TranscriptData {
  transcript: string;
  words?: WordTimestamp[];
  processor: 'ElevenLabs' | 'OpenAI';
}

// Define expected API response structure (based on docs/observation)
interface ElevenLabsWord {
  word: string;
  start_time: number;
  end_time: number;
}

interface ElevenLabsTranscriptionResponse {
  language_code: string;
  transcript: string;
  words: ElevenLabsWord[];
  // Potentially other fields
}

// Define structure for OpenAI verbose response (adapt if needed based on actual API response)
interface OpenAIWordTimestamp {
  word: string;
  start: number;
  end: number;
}
interface WhisperVerboseJsonResponse {
  text: string;
  words: OpenAIWordTimestamp[];
  // Other potential fields like language, segments etc.
}

// --- Helper Functions (Placeholders - Implement based on guide) ---

async function transcribeDirectElevenLabs(filePath: string, languageCode?: string): Promise<TranscriptData | null> {
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
    const fileBuffer = await fsPromises.readFile(filePath);
    const form = new FormData();
    form.append('file', Readable.from(fileBuffer), path.basename(filePath)); // Use stream
    form.append('model_id', 'scribe_v1'); // Use the specified model
    form.append('timestamps_granularity', 'word');
    form.append('diarize', 'false');
    if (languageCode) {
      form.append('language_code', languageCode);
    }

    // Set timeout for the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT); 

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, ...form.getHeaders() }, // Include form-data headers
      body: form,
      signal: controller.signal as any, // Type assertion needed for AbortSignal
    });

    clearTimeout(timeoutId); // Clear timeout if fetch completes

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[TranscribeJob] ElevenLabs API error (${response.status}): ${errorBody}`);
      throw new Error(`ElevenLabs API request failed with status ${response.status}`);
    }

    const result = await response.json() as ElevenLabsTranscriptionResponse;

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
    const words: WordTimestamp[] = result.words.map(w => ({
      word: w.word,
      start: w.start_time,
      end: w.end_time,
    }));

    return {
      transcript: result.transcript,
      words: words,
      processor: 'ElevenLabs',
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
        console.error('[TranscribeJob] ElevenLabs API call timed out.');
    } else {
        console.error('[TranscribeJob] Error during direct ElevenLabs transcription:', error);
    }
    return null; // Indicate failure
  }
}

async function transcribeChunkElevenLabs(
  chunkPath: string,
  startTimeOffset: number,
  languageCode?: string
): Promise<{ words: WordTimestamp[] } | null> {
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
    const fileBuffer = await fsPromises.readFile(chunkPath);
    const form = new FormData();
    form.append('file', Readable.from(fileBuffer), path.basename(chunkPath));
    form.append('model_id', 'scribe_v1');
    form.append('timestamps_granularity', 'word');
    form.append('diarize', 'false');
    if (languageCode) {
      form.append('language_code', languageCode);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, ...form.getHeaders() },
      body: form,
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[TranscribeJob] ElevenLabs chunk API error (${response.status}) for ${chunkPath}: ${errorBody}`);
      // Don't throw here, let the retry logic handle it
      return null; 
    }

    const result = await response.json() as ElevenLabsTranscriptionResponse;

    if (!result || !result.words || result.words.length === 0) {
      console.warn(`[TranscribeJob] ElevenLabs chunk response missing words data for ${chunkPath}.`);
      return null; // Consider success if transcript exists? No, need words for combining.
    }

    // Adjust timestamps by adding the offset
    const words: WordTimestamp[] = result.words.map(w => ({
      word: w.word,
      start: w.start_time + startTimeOffset,
      end: w.end_time + startTimeOffset,
    }));

    return { words }; // Return only the adjusted words for this chunk

  } catch (error: any) {
     if (error.name === 'AbortError') {
        console.error(`[TranscribeJob] ElevenLabs chunk API call timed out for ${chunkPath}.`);
    } else {
        console.error(`[TranscribeJob] Error during ElevenLabs chunk transcription for ${chunkPath}:`, error);
    }
    return null; // Indicate failure for retry logic
  }
}

async function transcribeChunksOpenAI(
  chunksToProcess: { path: string, index: number, start: number, end: number }[],
  languageCode?: string
): Promise<{ chunkIndex: number, words: WordTimestamp[] }[]> {
  console.log(`[TranscribeJob] Transcribing ${chunksToProcess.length} chunks with OpenAI fallback`);
  if (!process.env.OPENAI_API_KEY) {
    console.error('[TranscribeJob] OpenAI API key not configured for fallback.');
    return [];
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const limit = pLimit(MAX_CONCURRENT_CHUNKS_OPENAI);
  const results: { chunkIndex: number, words: WordTimestamp[] }[] = [];

  const transcriptionPromises = chunksToProcess.map((chunk) =>
    limit(async () => {
      console.log(`[TranscribeJob] Processing chunk ${chunk.index} with OpenAI fallback: ${chunk.path}`);
      try {
        // Use the standard fs module for createReadStream
        const fileStream = fs.createReadStream(chunk.path);
        
        const transcription = await openai.audio.transcriptions.create({
          file: fileStream,
          model: 'whisper-1', 
          language: languageCode, 
          response_format: 'verbose_json',
          timestamp_granularities: ['word'],
        });

        // Cast to expected verbose structure - use with caution, validate if possible
        const verboseResponse = transcription as unknown as WhisperVerboseJsonResponse;

        if (!verboseResponse.words || verboseResponse.words.length === 0) {
          console.warn(`[TranscribeJob] OpenAI fallback response for chunk ${chunk.index} missing words data.`);
          return; // Skip this chunk if no word data
        }

        // Adjust timestamps
        const adjustedWords: WordTimestamp[] = verboseResponse.words.map(w => ({
          word: w.word,
          start: w.start + chunk.start, // Add original chunk start time
          end: w.end + chunk.start,   // Add original chunk start time
        }));

        results.push({ chunkIndex: chunk.index, words: adjustedWords });
        console.log(`[TranscribeJob] Successfully transcribed chunk ${chunk.index} with OpenAI.`);

      } catch (error: any) {
        console.error(`[TranscribeJob] OpenAI fallback transcription failed for chunk ${chunk.index} (${chunk.path}):`, error.message || error);
        // Optionally track failed chunks here too, though combine logic might handle missing entries
      }
    })
  );

  await Promise.all(transcriptionPromises);
  console.log(`[TranscribeJob] OpenAI fallback processing finished. ${results.length} chunks successfully processed.`);
  return results;
}

async function combineTranscriptions(
  elevenLabsResultsPath: string, 
  openAIResults: { chunkIndex: number, words: WordTimestamp[] }[],
  allChunkIndices: number[]
): Promise<TranscriptData | null> {
  console.log('[TranscribeJob] Combining transcription results...');
  const combinedWordsMap = new Map<number, WordTimestamp[]>();
  let processorUsed: 'ElevenLabs' | 'OpenAI' = 'ElevenLabs'; // Default

  // 1. Read ElevenLabs results from the temporary JSONL file
  try {
    const fileContent = await fsPromises.readFile(elevenLabsResultsPath, 'utf-8');
    const lines = fileContent.trim().split('\n');
    for (const line of lines) {
      if (line) {
        const result = JSON.parse(line) as { chunkIndex: number, words: WordTimestamp[] };
        combinedWordsMap.set(result.chunkIndex, result.words);
      }
    }
  } catch (err: any) {
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
  let allWords: WordTimestamp[] = [];
  for (const index of allChunkIndices) {
    const wordsForChunk = combinedWordsMap.get(index);
    if (wordsForChunk) {
      allWords = allWords.concat(wordsForChunk);
    } else {
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
}

async function transcribeFullFallbackOpenAI(filePath: string, languageCode?: string): Promise<TranscriptData | null> {
  console.log(`[TranscribeJob] Attempting full fallback transcription with OpenAI for ${filePath}`);
  if (!process.env.OPENAI_API_KEY) {
    console.error('[TranscribeJob] OpenAI API key not configured for fallback.');
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Use createReadStream for potentially large files
    const fileStream = fs.createReadStream(filePath);

    console.log(`[TranscribeJob] Calling OpenAI full fallback transcription API...`);
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1', // Using whisper-1 as the primary model for fallback transcription
      language: languageCode,
      response_format: 'text', // Request plain text, no timestamps needed
    });

    // The response type for 'text' format is just a string
    const transcriptText = transcription as unknown as string;

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

  } catch (error: any) {
    console.error(`[TranscribeJob] Error during OpenAI full fallback transcription:`, error.message || error);
    return null;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
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
      fsPromises.unlink(destPath).catch(e => console.error("Error deleting partial download:", e)); // Delete partial file on error
      reject(err);
    });
  });
}

// --- Main Job Processor ---
export const processAudioTranscription = async (job: Job<{ sourceId: number; audioFilePath: string; languageCode?: string }>) => {
  // Directly use the storagePath passed in job data
  const { sourceId, audioFilePath: storagePath, languageCode } = job.data; 
  console.log(`[TranscribeJob] Starting transcription for source ${sourceId}, storagePath: ${storagePath}`);

  // Ensure storagePath from job data is valid before proceeding
  if (!storagePath || typeof storagePath !== 'string') {
      console.error(`[TranscribeJob] Invalid or missing storagePath in job data for source ${sourceId}:`, storagePath);
       await db.update(sources).set({ 
           processingStatus: 'FAILED', 
           processingStage: 'TRANSCRIPTION_ERROR', 
           processingError: 'Invalid storage path received in job data' 
       }).where(eq(sources.id, sourceId));
       // Throw error to mark job as failed
      throw new Error(`Invalid storage path in job data for source ${sourceId}`);
  }

  // **NEW**: Download file from Supabase to a local temp path
  let localTempFilePath: string | undefined;
  let localTempDir: string | undefined;

  try {
    // Update status immediately (before download)
    await db.update(sources).set({ processingStatus: 'PROCESSING', processingStage: 'DOWNLOADING' }).where(eq(sources.id, sourceId));
    await job.updateProgress(5); // Progress: Starting Download

    // 1. Get Signed URL
    const signedUrl = await storageService.getSignedUrl(storagePath);

    // 2. Create local temporary file path
    localTempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), `studynaut-transcribe-${sourceId}-`));
    const originalExtension = path.extname(storagePath); // Get extension from original path
    localTempFilePath = path.join(localTempDir, `audio${originalExtension}`);
    console.log(`[TranscribeJob] Created temp dir: ${localTempDir}, temp file path: ${localTempFilePath}`);

    // 3. Download File
    await downloadFile(signedUrl, localTempFilePath);
    console.log(`[TranscribeJob] Successfully downloaded audio from Supabase to ${localTempFilePath}`);

    // --- Original logic starts here, using localTempFilePath --- 
    await job.updateProgress(10); // Progress: Starting

    const fileSize = await checkFileSize(localTempFilePath);
    let transcriptData: TranscriptData | null = null;
    let chunkingPerformed = false;

    // Determine transcription strategy
    if (fileSize <= FILE_SIZE_LIMIT_DIRECT_API) {
      // Attempt Direct ElevenLabs API
      console.log('[TranscribeJob] File size within limit, attempting direct ElevenLabs API.');
      transcriptData = await transcribeDirectElevenLabs(localTempFilePath, languageCode);
    } else {
      // Chunking needed
      console.log('[TranscribeJob] File size exceeds limit, chunking required.');
      chunkingPerformed = true;
      // Reuse localTempDir for chunks
      const chunks = await createAudioChunks(localTempFilePath, localTempDir, SEGMENT_TIME_SECONDS);
      await job.updateProgress(20); // Progress: Chunking done

      if (chunks.length === 0) {
        throw new Error('createAudioChunks did not return any chunks.');
      }

      const elevenLabsResultsPath = path.join(localTempDir, 'elevenlabs_results.jsonl');
      const allChunkIndices = chunks.map(c => c.index);
      const limit = pLimit(MAX_CONCURRENT_CHUNKS_ELEVENLABS);
      const permanentlyFailedChunkIndices: number[] = [];
      const resultsFileStream = fs.createWriteStream(elevenLabsResultsPath, { flags: 'a' });

      const chunkTasks = chunks.map((chunk, idx) => limit(async () => {
        for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
          const result = await transcribeChunkElevenLabs(chunk.path, chunk.start, languageCode);
          if (result) {
            resultsFileStream.write(JSON.stringify({ chunkIndex: chunk.index, words: result.words }) + '\n');
            await job.updateProgress(20 + Math.floor(60 * ((idx + 1) / chunks.length))); // Progress during chunk processing
            return; // Success
          }
          if (attempt === MAX_CHUNK_RETRIES) {
            permanentlyFailedChunkIndices.push(chunk.index);
          } else {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
      }));

      await Promise.all(chunkTasks);
      resultsFileStream.close();
      await job.updateProgress(80); // Progress: ElevenLabs chunking done

      let openAIResults: { chunkIndex: number, words: WordTimestamp[] }[] = [];
      if (permanentlyFailedChunkIndices.length > 0) {
        console.log(`[TranscribeJob] ${permanentlyFailedChunkIndices.length} chunks failed ElevenLabs, attempting OpenAI fallback.`);
        const failedChunks = chunks.filter(c => permanentlyFailedChunkIndices.includes(c.index));
        openAIResults = await transcribeChunksOpenAI(failedChunks, languageCode);
        await job.updateProgress(85); // Progress: OpenAI fallback attempt done
      }

      transcriptData = await combineTranscriptions(elevenLabsResultsPath, openAIResults, allChunkIndices);
    }

    // Fallback to Full OpenAI if Primary failed
    if (!transcriptData) {
      console.log('[TranscribeJob] Primary transcription (ElevenLabs) failed or returned no data. Falling back to full OpenAI transcription.');
      transcriptData = await transcribeFullFallbackOpenAI(localTempFilePath, languageCode);
      await job.updateProgress(90); // Progress: Fallback OpenAI done
    }

    if (!transcriptData || !transcriptData.transcript) {
      throw new Error('Transcription failed using both ElevenLabs and OpenAI fallback.');
    }

    // Update Source Record
    await db.update(sources).set({
      extractedText: transcriptData.transcript,
      metadata: { 
          ...(await db.select({ metadata: sources.metadata }).from(sources).where(eq(sources.id, sourceId)))[0]?.metadata || {}, // Preserve existing metadata
          languageCode: languageCode, // Add/update language code
          transcriptionProcessor: transcriptData.processor,
          wordTimestamps: transcriptData.words // Store word timestamps if available
       },
      processingStatus: 'COMPLETED', // Mark transcription as done
      processingStage: 'PENDING_AI_ANALYSIS', // Set next stage
      updatedAt: new Date(),
    }).where(eq(sources.id, sourceId));

    console.log(`[TranscribeJob] Successfully transcribed source ${sourceId}. Enqueuing next job.`);
    await job.updateProgress(100); // Progress: Complete

    // Enqueue the next job (e.g., AI analysis)
    await noteProcessingQueue.add(JobType.PROCESS_SOURCE_TEXT, { sourceId });

  } catch (error) {
    console.error(`[TranscribeJob] Failed to process transcription for source ${sourceId}:`, error);
    await db.update(sources).set({
      processingStatus: 'FAILED',
      processingError: `Transcription failed: ${(error as Error).message}`,
      updatedAt: new Date(),
    }).where(eq(sources.id, sourceId));
    // Optionally, re-throw the error if you want the job to be marked as failed in BullMQ
    throw error; 
  } finally {
    // **NEW**: Cleanup downloaded temporary file and directory
    if (localTempDir) {
      try {
        await fsPromises.rm(localTempDir, { recursive: true, force: true });
        console.log(`[TranscribeJob] Cleaned up temporary directory: ${localTempDir}`);
      } catch (cleanupError) {
        console.error(`[TranscribeJob] Error cleaning up temp directory ${localTempDir}:`, cleanupError);
      }
    }
  }
}; 