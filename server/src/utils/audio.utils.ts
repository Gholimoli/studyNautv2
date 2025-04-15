import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

/**
 * Checks the size of a file.
 * @param filePath Path to the file.
 * @returns The size of the file in bytes.
 */
export async function checkFileSize(filePath: string): Promise<number> {
  const stats = await fsPromises.stat(filePath);
  return stats.size;
}

/**
 * Parses duration from ffmpeg -i output (stderr).
 * Handles HH:MM:SS.ms format.
 * @param output The stderr string from ffmpeg -i.
 * @returns Duration in seconds, or null if parsing fails.
 */
export function parseDuration(output: string): number | null {
  // Look for Duration: HH:MM:SS.ms in the stderr output
  const hmsMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1], 10);
    const minutes = parseInt(hmsMatch[2], 10);
    const seconds = parseInt(hmsMatch[3], 10);
    // Optionally parse milliseconds: const ms = parseInt(hmsMatch[4], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  console.warn("[AudioUtils] Could not parse duration from ffmpeg -i output:", output);
  return null;
}

/**
 * Gets audio duration using ffmpeg -i.
 * @param filePath Path to the input audio file.
 * @returns Duration in seconds.
 * @throws Error if ffmpeg fails or duration cannot be parsed.
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  // Use ffmpeg -i; duration info is usually in stderr
  // The command itself might exit with code 1 even on success if it just prints info
  const command = `ffmpeg -i ${JSON.stringify(filePath)}`;
  console.log(`[AudioUtils] Running command to get duration: ${command}`);
  let output = '';
  try {
    // We expect the duration info in stderr
    await execAsync(command);
    // If execAsync doesn't throw, it means ffmpeg completed successfully (e.g., conversion)
    // which is not what we expect here. Still, output might be in stdout/stderr.
     console.warn("[AudioUtils] ffmpeg -i command completed without error, which is unusual when only seeking info. Checking output.");
  } catch (error: any) {
    // It's common for ffmpeg -i to exit with an error code when just providing info
    // The crucial part is the stderr output containing the duration
    if (error.stderr) {
      output = error.stderr;
    } else {
      // If no stderr, then a real error likely occurred
      console.error(`[AudioUtils] ffmpeg -i failed unexpectedly for ${filePath}:`, error);
      throw new Error(`Failed to execute ffmpeg -i for duration: ${error.message || 'Unknown error'}`);
    }
  }

  // Log the captured output for debugging
  console.log(`[AudioUtils] ffmpeg -i output (stderr):\n${output}`);

  const durationSeconds = parseDuration(output);

  if (durationSeconds === null) {
    console.error(`[AudioUtils] Failed to parse duration from ffmpeg -i output for ${filePath}. Output was:\n${output}`);
    throw new Error(`Could not parse duration from ffmpeg output for ${filePath}.`);
  }

  console.log(`[AudioUtils] Parsed duration: ${durationSeconds} seconds for ${filePath}`);
  return durationSeconds;
}

/**
 * Creates audio chunks using ffmpeg.
 * @param filePath Path to the input audio file.
 * @param outputDir Directory to save the chunks.
 * @param segmentTimeSeconds Target duration for each chunk in seconds.
 * @returns Metadata for each created chunk.
 * @throws Error if ffmpeg fails to create chunks.
 */
export async function createAudioChunks(
    filePath: string, 
    outputDir: string, 
    segmentTimeSeconds: number = 600 // Default to 10 minutes
): Promise<{ path: string, index: number, start: number, end: number }[]> {
  console.log(`[AudioUtils] Creating audio chunks for ${filePath} in ${outputDir} with target segment time ${segmentTimeSeconds}s`);
  
  // Get duration using the updated getAudioDuration function
  let durationSeconds: number;
  try {
     durationSeconds = await getAudioDuration(filePath);
  } catch (error) {
     console.error(`[AudioUtils] Failed to get duration for chunking ${filePath}:`, error);
     // Re-throw the error as duration is critical for segmenting
     throw error;
  }

  const outputPattern = path.join(outputDir, 'chunk_%03d' + path.extname(filePath));
  // Use segment muxer which is generally preferred for splitting
  // -c copy: fast, but might be less precise at split points than re-encoding
  // -reset_timestamps 1: Start timestamps from 0 in each segment
  // -map 0: Ensure all streams (audio, potentially video/metadata) are mapped
  const ffmpegCommand = `ffmpeg -i ${JSON.stringify(filePath)} -map 0 -c copy -f segment -segment_time ${segmentTimeSeconds} -reset_timestamps 1 ${JSON.stringify(outputPattern)}`;

  console.log(`[AudioUtils] Running ffmpeg: ${ffmpegCommand}`);
  try {
    await execAsync(ffmpegCommand);
  } catch (err: any) {
    console.error(`[AudioUtils] ffmpeg chunking failed:`, err);
    // Provide more context in the error
    throw new Error(`ffmpeg failed to create chunks for ${filePath}: ${err.message || 'Unknown error'}`);
  }

  // Verify chunks were created
  const files = await fsPromises.readdir(outputDir);
  const chunkFiles = files
    .filter(f => f.startsWith('chunk_') && f.endsWith(path.extname(filePath)))
    .sort(); // Sort ensures chronological order based on %03d naming

  if (chunkFiles.length === 0) {
     console.error("[AudioUtils] ffmpeg command ran but no chunks were found in", outputDir);
     throw new Error(`Chunking process failed to produce output files in ${outputDir}.`);
  }

  const chunksMetadata: { path: string, index: number, start: number, end: number }[] = [];
  // Calculate chunk metadata based on segment time and total duration
  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkPath = path.join(outputDir, chunkFiles[i]);
    const estimatedStart = i * segmentTimeSeconds;
    // Ensure end time doesn't exceed total duration
    const estimatedEnd = Math.min((i + 1) * segmentTimeSeconds, durationSeconds); // Use the obtained duration

    chunksMetadata.push({
      path: chunkPath,
      index: i,
      start: estimatedStart,
      end: estimatedEnd,
    });
    // Note: Could run ffprobe on each chunk for precise timings, but adds overhead.
    // If highest precision is needed, that's the way.
  }

  console.log(`[AudioUtils] Created ${chunksMetadata.length} chunks for ${filePath}.`);
  return chunksMetadata;
} 