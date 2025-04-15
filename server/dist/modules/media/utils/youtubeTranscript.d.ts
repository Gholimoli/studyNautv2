export interface YouTubeTranscriptSegment {
    text: string;
    start: number;
    end: number;
}
/**
 * Fetches the transcript for a YouTube video, with timestamps.
 * @param videoIdOrUrl The YouTube video ID or full URL.
 * @returns Array of transcript segments with text, start, and end times.
 * @throws Error if transcript is unavailable or video is unsupported.
 */
export declare function getYouTubeTranscript(videoIdOrUrl: string): Promise<YouTubeTranscriptSegment[]>;
