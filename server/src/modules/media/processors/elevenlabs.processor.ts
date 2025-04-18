import { Job } from 'bullmq'; // Keep existing unrelated imports
import { db } from '@/core/db/index'; // Revert to alias
import { sources } from '@/core/db/schema'; // Revert to alias
import { eq } from 'drizzle-orm';
import path from 'path';
import fsPromises from 'fs/promises';
import { TranscriptData, ElevenLabsTranscriptionResponse, OpenAIWord } from '@shared/types/transcript.types'; // Revert to alias
import os from 'os';
import pLimit from 'p-limit';
import OpenAI from 'openai';
import { noteProcessingQueue } from '@/core/jobs/queue'; // Revert to alias
import { JobType } from '@/core/jobs/job.definition'; // Revert to alias
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Readable } from 'stream';
import fs from 'fs';
import https from 'https'; 
import { storageService } from '@/core/services/storage.service'; // Revert to alias
import { processSpecificAudioChunksWithOpenAI } from './openai.processor';
import { createAudioChunks, checkFileSize, getAudioDuration } from '@/utils/audio.utils'; // Revert to alias
import {
  createTempDir,
  cleanupTempDir,
  createChunks,
  transcribeChunk,
  processChunksInParallel,
  combineTranscriptionsFromSources
} from './elevenlabs.utils'; // Import from utils
import { config } from '@/core/config/config'; // Import validated config

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

interface TranscriptionResult {
  chunkIndex: number;
  words: OpenAIWord[]; // Using OpenAIWord as a common structure for adjusted words
}

// --- Main Exported Function --- 
export async function processAudioWithElevenLabs(audioFilePath: string, languageCode?: string): Promise<TranscriptData | null> {
  const apiKey = config.ai.elevenlabsApiKey;
  if (!apiKey) {
    console.error('[ElevenLabsProcessor] ELEVENLABS_API_KEY is not configured in config.');
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
      // Call the utility function directly
      const result = await transcribeChunk(audioFilePath, languageCode, 0, 1);
      if (result && result.words.length > 0) {
        const transcript = result.words.map((w: OpenAIWord) => w.word).join(' ');
        return { title: path.basename(audioFilePath), transcript: transcript, words: result.words };
      } else {
         console.warn("[ElevenLabsProcessor] Direct API call returned no words or failed.");
         // Return empty transcript if direct call yields nothing useful
         return { title: path.basename(audioFilePath), transcript: "", words: [] }; 
      }
    }

    // Scenario B: Chunking (File Size > Limit)
    console.log(`[ElevenLabsProcessor] File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) exceeds limit. Starting chunking.`);
    tempDir = await createTempDir(); // Use util
    const chunks = await createChunks(audioFilePath, tempDir); // Use util
    if (chunks.length === 0) {
        throw new Error("Failed to create any audio chunks.");
    }
    
    elevenLabsResultsPath = path.join(tempDir, 'elevenlabs_results.jsonl');
    const allChunkIndices = chunks.map(c => c.index);

    console.log(`[ElevenLabsProcessor] Processing ${chunks.length} chunks in parallel...`);
    // Call the utility function
    const permanentlyFailedChunkIndices = await processChunksInParallel(chunks, languageCode, elevenLabsResultsPath);

    let openAIResults = null; // Initialize as null
    if (permanentlyFailedChunkIndices.length > 0) {
      console.warn(`[ElevenLabsProcessor] ${permanentlyFailedChunkIndices.length} chunks failed ElevenLabs processing. Attempting OpenAI fallback.`);
      const failedChunksMetadata = chunks.filter(chunk => permanentlyFailedChunkIndices.includes(chunk.index));
      // Assuming processSpecificAudioChunksWithOpenAI handles its own errors/config check
      openAIResults = await processSpecificAudioChunksWithOpenAI(failedChunksMetadata, languageCode);
       if (!openAIResults || openAIResults.length === 0) {
            console.warn("[ElevenLabsProcessor] OpenAI fallback did not return results for failed chunks.");
        }
    }

    console.log('[ElevenLabsProcessor] Combining results from sources...');
    // Call the utility function
    return await combineTranscriptionsFromSources(elevenLabsResultsPath, openAIResults, allChunkIndices);

  } catch (error) {
    console.error('[ElevenLabsProcessor] Error during audio processing pipeline:', error);
    return null; // Indicate failure
  } finally {
    // Cleanup temporary directory if created
    if (tempDir) {
      await cleanupTempDir(tempDir); // Use util
    }
  }
} 