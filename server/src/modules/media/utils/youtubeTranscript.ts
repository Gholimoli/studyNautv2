export interface YouTubeTranscriptSegment {
  text: string;
  start: number; // seconds
  end: number;   // seconds
}

/**
 * Fetches the transcript for a YouTube video, with timestamps.
 * @param videoIdOrUrl The YouTube video ID or full URL.
 * @returns Array of transcript segments with text, start, and end times.
 * @throws Error if transcript is unavailable or video is unsupported.
 */
export async function getYouTubeTranscript(videoIdOrUrl: string): Promise<YouTubeTranscriptSegment[]> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const segments = await YoutubeTranscript.fetchTranscript(videoIdOrUrl);
    return segments.map((seg: { text: string; offset: number; duration: number }) => ({
      text: seg.text,
      start: seg.offset,
      end: seg.offset + seg.duration,
    }));
  } catch (error: any) {
    if (error.message?.includes('No transcript available')) {
      throw new Error('No transcript/captions available for this video.');
    }
    throw new Error(`Failed to fetch YouTube transcript: ${error.message || error}`);
  }
} 