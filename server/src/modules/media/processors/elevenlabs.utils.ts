import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

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
 * Get the duration of an audio file in seconds using ffprobe.
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration)) {
      throw new Error('ffprobe did not return a valid number for duration');
    }
    return duration;
  } catch (error) {
    console.error(`[ElevenLabsUtils] Error getting duration for ${filePath}:`, error);
    throw new Error(`Failed to get audio duration using ffprobe: ${(error as Error).message}`);
  }
}

/**
 * Split an audio file into chunks of approximately CHUNK_SIZE_MB, clamped to min/max duration.
 */
export async function createChunks(audioFilePath: string, tempDir: string): Promise<ChunkMetadata[]> {
  const fileSize = (await fs.promises.stat(audioFilePath)).size;
  const duration = await getAudioDuration(audioFilePath);
  const chunks: ChunkMetadata[] = [];
  let currentPosition = 0;

  // Calculate estimated chunk duration based on target size, clamped
  const estimatedBytesPerSecond = fileSize / duration;
  let chunkDuration = (CHUNK_SIZE_MB * 1024 * 1024) / estimatedBytesPerSecond;
  chunkDuration = Math.max(MIN_CHUNK_DURATION_SECONDS, Math.min(MAX_CHUNK_DURATION_SECONDS, chunkDuration));

  console.log(`[ElevenLabsUtils] Splitting file (${(fileSize / 1024 / 1024).toFixed(2)} MB, ${duration.toFixed(2)}s) into chunks of ~${chunkDuration.toFixed(2)}s`);

  let chunkIndex = 0;
  while (currentPosition < duration) {
    const startTime = currentPosition;
    const endTime = Math.min(currentPosition + chunkDuration, duration);
    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}.m4a`);
    const command = `ffmpeg -i "${audioFilePath}" -ss ${startTime} -to ${endTime} -c copy -y "${chunkPath}"`;
    try {
      await execAsync(command);
      chunks.push({ path: chunkPath, index: chunkIndex, start: startTime, end: endTime });
      console.log(`[ElevenLabsUtils] Created chunk ${chunkIndex}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
    } catch (error) {
      console.error(`[ElevenLabsUtils] Error creating chunk ${chunkIndex}:`, error);
      throw new Error(`Failed to create audio chunk ${chunkIndex} using ffmpeg: ${(error as Error).message}`);
    }
    currentPosition = endTime;
    chunkIndex++;
    if (chunkIndex > 1000) {
      console.error("[ElevenLabsUtils] Exceeded maximum chunk limit (1000). Aborting chunk creation.");
      throw new Error("Exceeded maximum chunk limit during audio splitting.");
    }
  }
  return chunks;
} 