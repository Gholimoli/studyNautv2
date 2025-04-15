import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  createAudioChunks as createAudioChunksUtil,
  getAudioDuration as getAudioDurationUtil
} from '../../../utils/audio.utils';

const execAsync = promisify(exec);

export interface ChunkMetadata {
  path: string;
  index: number;
  start: number;
  end: number;
}

const CHUNK_SIZE_MB = 5;
const MIN_CHUNK_DURATION_SECONDS = 10;
const MAX_CHUNK_DURATION_SECONDS = 600;

/**
 * Create a temporary directory for chunk files.
 */
export async function createTempDir(): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `studynaut-chunks-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Recursively remove a temporary directory.
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
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

  // Calculate estimated chunk duration based on target size, clamped
  const estimatedBytesPerSecond = fileSize / duration;
  let chunkDuration = (CHUNK_SIZE_MB * 1024 * 1024) / estimatedBytesPerSecond;
  chunkDuration = Math.max(MIN_CHUNK_DURATION_SECONDS, Math.min(MAX_CHUNK_DURATION_SECONDS, chunkDuration));

  console.log(`[ElevenLabsUtils] Calculated target chunk duration: ${chunkDuration.toFixed(2)}s`);

  try {
    const chunksMetadata = await createAudioChunksUtil(audioFilePath, tempDir, chunkDuration);
    return chunksMetadata;
  } catch (error) {
    console.error("[ElevenLabsUtils] Error creating chunks using audio.utils:", error);
    throw error;
  }
} 