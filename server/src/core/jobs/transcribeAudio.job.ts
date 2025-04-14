import { Job } from 'bullmq';
import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fsPromises from 'fs/promises'; // Alias the promises import
import fs from 'fs'; // Import the standard fs module
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import pLimit from 'p-limit';
import OpenAI from 'openai'; // For fallback
import { env } from '@/core/config'; // For API keys
import { noteProcessingQueue } from '@/core/jobs/queue'; // To enqueue next job
import fetch from 'node-fetch'; // Import fetch
import FormData from 'form-data'; // Import FormData
import { Readable } from 'stream'; // For creating stream from buffer

const execAsync = util.promisify(exec);

// --- Constants (adjust as needed) ---
const FILE_SIZE_LIMIT_DIRECT_API = 25 * 1024 * 1024; // 25MB
const CHUNK_SIZE_MB = 5;
const CHUNK_SIZE_BYTES = CHUNK_SIZE_MB * 1024 * 1024;
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

async function checkFileSize(filePath: string): Promise<number> {
  const stats = await fsPromises.stat(filePath);
  return stats.size;
}

async function transcribeDirectElevenLabs(filePath: string, languageCode?: string): Promise<TranscriptData | null> {
  console.log(`[TranscribeJob] Attempting direct ElevenLabs transcription for ${filePath}`);
  if (!env.ELEVENLABS_API_KEY) {
    console.error('[TranscribeJob] ElevenLabs API key not configured.');
    return null;
  }

  const url = 'https://api.elevenlabs.io/v1/speech-to-text';
  const headers = {
    'Accept': 'application/json',
    'xi-api-key': env.ELEVENLABS_API_KEY,
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

// Helper to parse ffprobe duration output (e.g., "123.456")
function parseDuration(output: string): number | null {
  const match = output.match(/duration=(\d+\.\d+)/i) || output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  if (match && match[1] && match[2] && match[3]) {
    // HH:MM:SS.ms format
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
  } 
  // Check for simpler seconds format
  const durationMatch = output.match(/duration=([0-9.]+)/i);
   if (durationMatch && durationMatch[1]) {
      return parseFloat(durationMatch[1]);
   }
  console.warn("[TranscribeJob] Could not parse duration from ffprobe output:", output);
  return null;
}

async function createAudioChunks(filePath: string, outputDir: string): Promise<{ path: string, index: number, start: number, end: number }[]> {
  console.log(`[TranscribeJob] Creating audio chunks for ${filePath} in ${outputDir}`);
  let durationSeconds: number | null = null;
  try {
    const { stdout: ffprobeOutput } = await execAsync(`ffprobe -v error -show_format -show_streams -of flat=s=_ -sexagesimal ${JSON.stringify(filePath)}`);
    durationSeconds = parseDuration(ffprobeOutput);
  } catch (err: any) {
    console.warn(`[TranscribeJob] ffprobe failed for ${filePath}, cannot determine exact chunk times:`, err.message);
  }

  if (!durationSeconds) {
    console.warn("[TranscribeJob] Could not get duration, cannot create precise chunks.");
    // Consider throwing error or implementing fallback if duration is critical
    // For now, we might proceed but start/end times will be rough estimates
    // Or attempt simple segmentation without duration?
    throw new Error('Failed to get audio duration via ffprobe, cannot proceed with chunking.'); 
  }
  
  const segmentTimeSeconds = 600; // Target segment length (e.g., 10 minutes). Adjust as needed.
  // ffmpeg can sometimes create slightly longer/shorter segments.
  
  const outputPattern = path.join(outputDir, 'chunk_%03d' + path.extname(filePath));
  const ffmpegCommand = `ffmpeg -i ${JSON.stringify(filePath)} -f segment -segment_time ${segmentTimeSeconds} -c copy -reset_timestamps 1 ${JSON.stringify(outputPattern)}`;

  console.log(`[TranscribeJob] Running ffmpeg: ${ffmpegCommand}`);
  try {
    await execAsync(ffmpegCommand);
  } catch (err: any) {
    console.error(`[TranscribeJob] ffmpeg chunking failed:`, err);
    throw new Error(`ffmpeg failed to create chunks: ${err.message}`);
  }

  // List created chunk files
  const files = await fsPromises.readdir(outputDir);
  const chunkFiles = files
    .filter(f => f.startsWith('chunk_') && f.endsWith(path.extname(filePath)))
    .sort(); // Sort ensures chronological order based on %03d

  const chunksMetadata: { path: string, index: number, start: number, end: number }[] = [];
  let currentTime = 0;
  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkPath = path.join(outputDir, chunkFiles[i]);
    // Estimate start/end based on segment time - actual duration might vary slightly
    const estimatedStart = i * segmentTimeSeconds;
    const estimatedEnd = Math.min((i + 1) * segmentTimeSeconds, durationSeconds);
    
    chunksMetadata.push({
      path: chunkPath,
      index: i,
      start: estimatedStart, 
      end: estimatedEnd,
    });
    // Note: Could run ffprobe on each chunk for precise timings, but adds overhead.
  }

  if (chunksMetadata.length === 0) {
     console.error("[TranscribeJob] ffmpeg command ran but no chunks were found in", outputDir);
     throw new Error("Chunking process failed to produce output files.");
  }
  
  console.log(`[TranscribeJob] Created ${chunksMetadata.length} chunks.`);
  return chunksMetadata;
}

async function transcribeChunkElevenLabs(
  chunkPath: string,
  startTimeOffset: number,
  languageCode?: string
): Promise<{ words: WordTimestamp[] } | null> {
  console.log(`[TranscribeJob] Transcribing chunk (ElevenLabs): ${chunkPath} with offset ${startTimeOffset}`);
  if (!env.ELEVENLABS_API_KEY) {
    console.error('[TranscribeJob] ElevenLabs API key not configured.');
    return null;
  }

  const url = 'https://api.elevenlabs.io/v1/speech-to-text';
  const headers = {
    'Accept': 'application/json',
    'xi-api-key': env.ELEVENLABS_API_KEY,
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
  if (!env.OPENAI_API_KEY) {
    console.error('[TranscribeJob] OpenAI API key not configured for fallback.');
    return [];
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
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
  if (!env.OPENAI_API_KEY) {
    console.error('[TranscribeJob] OpenAI API key not configured for fallback.');
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
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

// --- Main Job Processor --- 
export const processAudioTranscription = async (job: Job<{ sourceId: number }>) => {
  const { sourceId } = job.data;
  console.log(`[TranscribeJob] Starting transcription for sourceId: ${sourceId}`);

  const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });

  if (!source || source.sourceType !== 'AUDIO' || !source.storagePath) {
    console.error(`[TranscribeJob] Invalid source or missing data for sourceId: ${sourceId}`);
    throw new Error(`Invalid source or missing data for sourceId: ${sourceId}`);
  }

  await db.update(sources)
    .set({ processingStatus: 'PROCESSING', processingStage: 'TRANSCRIPTION' })
    .where(eq(sources.id, sourceId));

  const audioFilePath = path.resolve(__dirname, '../../', source.storagePath); // Assumes storagePath is relative to server root
  let transcriptData: TranscriptData | null = null;
  let finalError: Error | null = null;
  let tempDir: string | null = null;

  try {
    // Check file size
    const fileSize = await checkFileSize(audioFilePath);

    if (fileSize <= FILE_SIZE_LIMIT_DIRECT_API) {
      // --- Direct API Call --- 
      transcriptData = await transcribeDirectElevenLabs(audioFilePath, source.metadata?.languageCode);
    } else {
      // --- Chunking Workflow --- 
      tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'studynaut-chunks-'));
      const chunks = await createAudioChunks(audioFilePath, tempDir);
      const allChunkIndices = chunks.map(c => c.index);
      const elevenLabsResultsPath = path.join(tempDir, 'elevenlabs_results.jsonl');
      const permanentlyFailedChunkIndices: number[] = [];
      const limit = pLimit(MAX_CONCURRENT_CHUNKS_ELEVENLABS);
      const chunkProcessingPromises: Promise<void>[] = [];

      console.log(`[TranscribeJob] Starting parallel processing for ${chunks.length} chunks...`);

      // Create a writable stream for the results file
      const resultsStream = fs.createWriteStream(elevenLabsResultsPath, { flags: 'a' });

      for (const chunk of chunks) {
        chunkProcessingPromises.push(
          limit(async () => {
            let attempt = 0;
            let success = false;
            while (attempt < MAX_CHUNK_RETRIES && !success) {
              attempt++;
              console.log(`[TranscribeJob] Attempt ${attempt}/${MAX_CHUNK_RETRIES} for chunk ${chunk.index}`);
              const result = await transcribeChunkElevenLabs(chunk.path, chunk.start, source.metadata?.languageCode);
              if (result && result.words) {
                // Success: Write result to JSONL file
                const resultLine = JSON.stringify({ chunkIndex: chunk.index, words: result.words }) + '\n';
                resultsStream.write(resultLine);
                success = true;
                console.log(`[TranscribeJob] Successfully processed chunk ${chunk.index} on attempt ${attempt}`);
              } else if (attempt < MAX_CHUNK_RETRIES) {
                // Failure, but retries remain
                console.warn(`[TranscribeJob] Chunk ${chunk.index} failed attempt ${attempt}. Retrying in ${RETRY_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              }
            } // End retry loop

            if (!success) {
              console.error(`[TranscribeJob] Chunk ${chunk.index} failed permanently after ${MAX_CHUNK_RETRIES} attempts.`);
              permanentlyFailedChunkIndices.push(chunk.index);
            }
          })
        );
      } // End for loop

      // Wait for all chunk processing promises (including retries) to settle
      await Promise.all(chunkProcessingPromises);
      resultsStream.end(); // Close the results file stream
      console.log(`[TranscribeJob] Finished parallel chunk processing. ${permanentlyFailedChunkIndices.length} chunks failed permanently.`);

      // --- OpenAI Fallback for Failed Chunks --- 
      let openAIResults: { chunkIndex: number, words: WordTimestamp[] }[] = [];
      if (permanentlyFailedChunkIndices.length > 0) {
        const failedChunksMeta = chunks.filter(c => permanentlyFailedChunkIndices.includes(c.index));
        openAIResults = await transcribeChunksOpenAI(failedChunksMeta, source.metadata?.languageCode);
      }

      transcriptData = await combineTranscriptions(elevenLabsResultsPath, openAIResults, allChunkIndices);
    }

    // --- Service-Level Fallback (Optional - based on requirements) --- 
    if (!transcriptData) {
      console.warn(`[TranscribeJob] Primary transcription (ElevenLabs/Chunking) failed for ${sourceId}. Attempting full OpenAI fallback.`);
      transcriptData = await transcribeFullFallbackOpenAI(audioFilePath, source.metadata?.languageCode);
    }

    // --- Final Update --- 
    if (transcriptData) {
      await db.update(sources)
        .set({
          textContent: transcriptData.transcript, // Store transcript
          metadata: { ...(source.metadata || {}), transcriptWords: transcriptData.words, processor: transcriptData.processor }, // Store words and processor
          processingStatus: 'PENDING', // Ready for next stage
          processingStage: 'TEXT_ANALYSIS', // Next stage
          processingError: null,
        })
        .where(eq(sources.id, sourceId));

      console.log(`[TranscribeJob] Transcription successful for sourceId: ${sourceId}. Enqueuing TEXT_ANALYSIS.`);
      await noteProcessingQueue.add('PROCESS_SOURCE_TEXT', { sourceId });
    } else {
      throw new Error('Transcription failed after all attempts and fallbacks.');
    }

  } catch (error: any) {
    console.error(`[TranscribeJob] FAILED for sourceId: ${sourceId}`, error);
    finalError = error;
    await db.update(sources)
      .set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION', processingError: error.message || 'Unknown transcription error' })
      .where(eq(sources.id, sourceId));
    // Optionally re-throw the error if BullMQ should handle final failure state
    // throw error; 
  } finally {
    // Clean up temporary chunk directory
    if (tempDir) {
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        console.log(`[TranscribeJob] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[TranscribeJob] Error cleaning up temp directory ${tempDir}:`, cleanupError);
      }
    }
    console.log(`[TranscribeJob] Finished processing sourceId: ${sourceId}. Status: ${finalError ? 'FAILED' : 'SUCCESS'}`);
  }
}; 