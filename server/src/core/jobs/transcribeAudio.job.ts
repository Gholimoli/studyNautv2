import { Job } from 'bullmq';
import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fsPromises from 'fs/promises'; // Alias the promises import
import fs from 'fs'; // Import the standard fs module
import os from 'os';
import pLimit from 'p-limit';
import OpenAI from 'openai'; // For fallback
import { noteProcessingQueue } from '@/core/jobs/queue'; // To enqueue next job
import fetch from 'node-fetch'; // Import fetch
import FormData from 'form-data'; // Import FormData
import { Readable } from 'stream'; // For creating stream from buffer
import { checkFileSize, createAudioChunks } from '@/utils/audio.utils'; // Import from new location

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

// --- Main Job Processor --- 
export const processAudioTranscription = async (job: Job<{ sourceId: number }>) => {
  const { sourceId } = job.data;
  console.log(`[TranscribeJob] Starting transcription for sourceId: ${sourceId}`);

  await job.updateProgress(0);

  const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });

  if (!source || source.processingStatus === 'COMPLETED' || source.processingStatus === 'FAILED') {
    console.warn(`[TranscribeJob] Source ${sourceId} not found, already processed, or failed. Skipping.`);
    return;
  }

  // Check for file path in metadata
  const storagePath = (source?.metadata as { storagePath?: string } | null)?.storagePath;
  if (!storagePath) {
    console.error(`[TranscribeJob] Source ${sourceId} is missing storagePath in metadata. Cannot process.`);
    await db.update(sources).set({ processingStatus: 'FAILED', processingStage: 'TRANSCRIPTION', processingError: 'Missing file path' }).where(eq(sources.id, sourceId));
    return;
  }

  const audioFilePath = path.resolve(storagePath);
  // Access language code from metadata
  const languageCode = (source.metadata as { languageCode?: string } | null)?.languageCode;

  // Update status to PROCESSING
  await db.update(sources)
    .set({ processingStatus: 'PROCESSING', processingStage: 'TRANSCRIPTION_START' })
    .where(eq(sources.id, sourceId));

  let transcriptResult: TranscriptData | null = null;
  let tempDir: string | null = null; // To store chunks if needed

  try {
    // 1. Check file size
    const fileSize = await checkFileSize(audioFilePath); // Use imported function
    console.log(`[TranscribeJob] File size for ${sourceId}: ${fileSize} bytes`);
    await job.log(`Checked file size: ${fileSize} bytes`);

    // 2. Attempt Transcription (Direct or Chunked)
    if (fileSize <= FILE_SIZE_LIMIT_DIRECT_API) {
      // 2a. Direct ElevenLabs API call
      await job.updateProgress(10);
      await job.log('File size within limit, attempting direct ElevenLabs transcription.');
      transcriptResult = await transcribeDirectElevenLabs(audioFilePath, languageCode);
      if (transcriptResult) {
           await job.log('Direct ElevenLabs transcription successful.');
      } else {
          await job.log('Direct ElevenLabs transcription failed.');
      }
    } else {
      // 2b. Chunking required
      await job.updateProgress(10);
      await job.log('File size exceeds limit, starting chunking process.');
      tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), `studynaut-chunks-${sourceId}-`));
      console.log(`[TranscribeJob] Created temp dir for chunks: ${tempDir}`);

      // Use imported function, pass SEGMENT_TIME_SECONDS
      const chunks = await createAudioChunks(audioFilePath, tempDir, SEGMENT_TIME_SECONDS);
      await job.log(`Created ${chunks.length} audio chunks.`);
      await job.updateProgress(20);

      if (chunks.length === 0) {
        throw new Error('Audio chunking produced no files.');
      }

      // Process chunks in parallel with ElevenLabs
      const limitElevenLabs = pLimit(MAX_CONCURRENT_CHUNKS_ELEVENLABS);
      const elevenLabsResultsPath = path.join(tempDir, 'elevenlabs_results.jsonl');
      const permanentlyFailedChunkIndices: number[] = [];
      let completedChunks = 0;

      console.log(`[TranscribeJob] Processing ${chunks.length} chunks with ElevenLabs (Concurrency: ${MAX_CONCURRENT_CHUNKS_ELEVENLABS})...`);

      const transcriptionPromises = chunks.map((chunk) =>
        limitElevenLabs(async () => {
          let attempt = 0;
          while (attempt < MAX_CHUNK_RETRIES) {
            try {
              const result = await transcribeChunkElevenLabs(chunk.path, chunk.start, languageCode);
              if (result && result.words) {
                // Write successful result to file immediately
                const resultLine = JSON.stringify({ chunkIndex: chunk.index, words: result.words }) + '\n';
                await fsPromises.appendFile(elevenLabsResultsPath, resultLine);
                completedChunks++;
                await job.updateProgress(20 + Math.floor((completedChunks / chunks.length) * 50)); // Progress: 20% -> 70%
                await job.log(`Chunk ${chunk.index + 1}/${chunks.length} transcribed (ElevenLabs).`);
                return; // Success for this chunk
              } else {
                console.warn(`[TranscribeJob] ElevenLabs transcription attempt ${attempt + 1} for chunk ${chunk.index} returned null or no words.`);
                throw new Error('ElevenLabs returned no words'); // Treat as failure for retry
              }
            } catch (error) {
              console.error(`[TranscribeJob] Error processing chunk ${chunk.index} (Attempt ${attempt + 1}/${MAX_CHUNK_RETRIES}) with ElevenLabs:`, error);
              attempt++;
              if (attempt < MAX_CHUNK_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                await job.log(`Retrying chunk ${chunk.index + 1} (Attempt ${attempt + 1}).`);
              } else {
                console.error(`[TranscribeJob] Chunk ${chunk.index} failed permanently after ${MAX_CHUNK_RETRIES} attempts (ElevenLabs).`);
                permanentlyFailedChunkIndices.push(chunk.index);
                await job.log(`Chunk ${chunk.index + 1} failed permanently (ElevenLabs).`);
              }
            }
          }
        })
      );

      await Promise.all(transcriptionPromises);
      console.log('[TranscribeJob] Finished initial ElevenLabs chunk processing pass.');

      // Chunk-level fallback to OpenAI if needed
      let openAIChunkResults: { chunkIndex: number, words: WordTimestamp[] }[] = [];
      if (permanentlyFailedChunkIndices.length > 0) {
        await job.log(`Attempting OpenAI fallback for ${permanentlyFailedChunkIndices.length} failed chunks.`);
        console.log(`[TranscribeJob] Attempting OpenAI fallback for failed chunks: ${permanentlyFailedChunkIndices.join(', ')}`);
        const chunksForOpenAI = chunks.filter(chunk => permanentlyFailedChunkIndices.includes(chunk.index));
        openAIChunkResults = await transcribeChunksOpenAI(chunksForOpenAI, languageCode);
        await job.log(`OpenAI fallback completed for ${openAIChunkResults.length} chunks.`);
      }

      // Combine results
      await job.log('Combining transcription results...');
      const allChunkIndices = chunks.map(c => c.index);
      transcriptResult = await combineTranscriptions(elevenLabsResultsPath, openAIChunkResults, allChunkIndices);
        if (transcriptResult) {
           await job.log('Combined chunk transcriptions successfully.');
        } else {
          await job.log('Failed to combine chunk transcriptions.');
        }
    }

    // 3. Service-Level Fallback (OpenAI Full File) if primary path failed
    if (!transcriptResult || !transcriptResult.transcript) {
      console.warn(`[TranscribeJob] Primary transcription (ElevenLabs direct/chunked) failed for source ${sourceId}. Attempting full OpenAI fallback.`);
      await job.log('Primary transcription failed. Attempting full OpenAI fallback...');
      await job.updateProgress(75);
      transcriptResult = await transcribeFullFallbackOpenAI(audioFilePath, languageCode);
       if (transcriptResult) {
           await job.log('OpenAI full fallback transcription successful.');
       } else {
           await job.log('OpenAI full fallback transcription failed.');
       }
    }

    // 4. Final Check and Update Database
    if (transcriptResult && transcriptResult.transcript) {
      console.log(`[TranscribeJob] Transcription successful for source ${sourceId}. Processor: ${transcriptResult.processor}`);
      await job.log(`Transcription successful. Processor: ${transcriptResult.processor}. Length: ${transcriptResult.transcript.length}`);

      // Determine final status and next stage
      const nextStage = 'PENDING_AI_ANALYSIS'; // Or similar, depending on your pipeline
      const nextJobName = 'PROCESS_SOURCE_TEXT'; // The job that handles AI analysis

      await db.update(sources).set({
        processingStatus: 'COMPLETED', // Mark transcription as complete
        processingStage: nextStage,
        processingError: null,
        extractedText: transcriptResult.transcript,
        // Store word timings if available, adjust metadata structure as needed
        metadata: {
          // Use nullish coalescing operator to ensure metadata is an object before spreading
          ...(source.metadata ?? {}),
          wordTimestamps: transcriptResult.words,
          transcriptionProcessor: transcriptResult.processor,
          // Persist language safely
          language: languageCode || (source.metadata as { language?: string } | null)?.language,
        },
        updatedAt: new Date(),
      }).where(eq(sources.id, sourceId));

      // Enqueue the next job in the pipeline (e.g., AI analysis)
      await noteProcessingQueue.add(nextJobName, { sourceId });
      console.log(`[TranscribeJob] Enqueued ${nextJobName} job for source ${sourceId}`);
      await job.updateProgress(100);
      await job.log('Transcription complete. Enqueued next processing step.');

    } else {
      throw new Error('Transcription failed after all attempts (including fallback).');
    }

  } catch (error: any) {
    console.error(`[TranscribeJob] FATAL: Transcription failed for source ${sourceId}:`, error);
    await job.log(`ERROR: ${error.message}`);
    await db.update(sources).set({
      processingStatus: 'FAILED',
      processingStage: 'TRANSCRIPTION_ERROR',
      processingError: error.message || 'Unknown transcription error',
      updatedAt: new Date(),
    }).where(eq(sources.id, sourceId));
     await job.updateProgress(100); // Mark as complete even on failure for BullMQ UI
     // Optionally, throw the error again if you want BullMQ to mark the job as failed
     // throw error;

  } finally {
    // Clean up temporary directory if it was created
    if (tempDir) {
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        console.log(`[TranscribeJob] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`[TranscribeJob] Failed to clean up temp directory ${tempDir}:`, cleanupError);
      }
    }
  }
}; 