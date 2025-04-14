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
 * Parses duration from ffprobe output.
 * Handles HH:MM:SS.ms and simple seconds formats.
 * @param output The stdout string from ffprobe.
 * @returns Duration in seconds, or null if parsing fails.
 */
export function parseDuration(output: string): number | null {
  // Try HH:MM:SS.ms format first (from -sexagesimal flag often)
  const hmsMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1], 10);
    const minutes = parseInt(hmsMatch[2], 10);
    const seconds = parseInt(hmsMatch[3], 10);
    // Ignore milliseconds part for simplicity or parse if needed: const ms = parseInt(hmsMatch[4], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Try simpler duration=seconds.fraction format (often from -show_format or -of flat)
  // Match lines starting with duration= followed by digits and potentially a dot and more digits
  const simpleMatch = output.match(/^duration=([0-9\.]+)/m); // Use multiline flag
   if (simpleMatch && simpleMatch[1] && simpleMatch[1].toLowerCase() !== 'n/a') {
      return parseFloat(simpleMatch[1]);
   }

  // Fallback: Look for duration= pattern anywhere if the specific formats fail
  const genericDurationMatch = output.match(/duration=([0-9.]+)/i);
  if (genericDurationMatch && genericDurationMatch[1] && genericDurationMatch[1].toLowerCase() !== 'n/a') {
    return parseFloat(genericDurationMatch[1]);
  }


  console.warn("[AudioUtils] Could not parse duration from ffprobe output:", output);
  return null;
}


/**
 * Creates audio chunks using ffmpeg.
 * @param filePath Path to the input audio file.
 * @param outputDir Directory to save the chunks.
 * @param segmentTimeSeconds Target duration for each chunk in seconds.
 * @returns Metadata for each created chunk.
 * @throws Error if ffprobe fails to get duration or ffmpeg fails to create chunks.
 */
export async function createAudioChunks(
    filePath: string, 
    outputDir: string, 
    segmentTimeSeconds: number = 600 // Default to 10 minutes
): Promise<{ path: string, index: number, start: number, end: number }[]> {
  console.log(`[AudioUtils] Creating audio chunks for ${filePath} in ${outputDir}`);
  let durationSeconds: number | null = null;
  try {
    // Use -show_format which often gives a more reliable duration field
    const { stdout: ffprobeOutput } = await execAsync(`ffprobe -v error -show_format -of flat=s=_ -sexagesimal ${JSON.stringify(filePath)}`);
    durationSeconds = parseDuration(ffprobeOutput);
  } catch (err: any) {
    console.error(`[AudioUtils] ffprobe failed for ${filePath}:`, err.message);
    // Attempt to proceed, but log the error
     try {
        // Fallback attempt with -show_streams if -show_format failed
        const { stdout: ffprobeStreamOutput } = await execAsync(`ffprobe -v error -show_streams -of flat=s=_ -sexagesimal ${JSON.stringify(filePath)}`);
        durationSeconds = parseDuration(ffprobeStreamOutput);
        if (!durationSeconds) {
             console.warn(`[AudioUtils] ffprobe fallback with -show_streams also failed for ${filePath}`);
        }
     } catch(streamErr: any) {
         console.error(`[AudioUtils] ffprobe fallback with -show_streams also failed for ${filePath}:`, streamErr.message);
     }
     if (!durationSeconds) {
         // If we still don't have duration, we cannot create accurate chunks based on time.
         // Depending on requirements, you might throw, or attempt segmenting by size/count.
         // For now, throw an error as precise timing seems intended.
        throw new Error(`Failed to get audio duration via ffprobe for ${filePath}, cannot proceed with time-based chunking.`);
     }
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
    // Assert non-null (!) because the function throws earlier if durationSeconds is null
    const estimatedEnd = Math.min((i + 1) * segmentTimeSeconds, durationSeconds!);

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