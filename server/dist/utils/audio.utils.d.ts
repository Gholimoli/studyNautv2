/**
 * Checks the size of a file.
 * @param filePath Path to the file.
 * @returns The size of the file in bytes.
 */
export declare function checkFileSize(filePath: string): Promise<number>;
/**
 * Parses duration from ffmpeg -i output (stderr).
 * Handles HH:MM:SS.ms format.
 * @param output The stderr string from ffmpeg -i.
 * @returns Duration in seconds, or null if parsing fails.
 */
export declare function parseDuration(output: string): number | null;
/**
 * Gets audio duration using ffmpeg -i.
 * @param filePath Path to the input audio file.
 * @returns Duration in seconds.
 * @throws Error if ffmpeg fails or duration cannot be parsed.
 */
export declare function getAudioDuration(filePath: string): Promise<number>;
/**
 * Creates audio chunks using ffmpeg.
 * @param filePath Path to the input audio file.
 * @param outputDir Directory to save the chunks.
 * @param segmentTimeSeconds Target duration for each chunk in seconds.
 * @returns Metadata for each created chunk.
 * @throws Error if ffmpeg fails to create chunks.
 */
export declare function createAudioChunks(filePath: string, outputDir: string, segmentTimeSeconds?: number): Promise<{
    path: string;
    index: number;
    start: number;
    end: number;
}[]>;
