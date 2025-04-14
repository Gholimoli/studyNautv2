// Defines shared types related to audio transcription results

/**
 * Represents a single word with timing information.
 * Using a structure compatible with OpenAI's verbose_json response for fallback consistency.
 */
export interface OpenAIWord {
  word: string;
  start: number; // Start time in seconds
  end: number;   // End time in seconds
}

/**
 * Represents the structure of the response from ElevenLabs' speech-to-text API
 * when word timestamps are requested.
 */
export interface ElevenLabsTranscriptionResponse {
  // This might contain the full transcript text, but we primarily use words
  // full_text?: string;
  words: {
    word: string;
    start_time: number; // Note: Snake case from API
    end_time: number;   // Note: Snake case from API
  }[];
}

/**
 * Represents the final combined transcript data after processing.
 */
export interface TranscriptData {
  title: string;          // Title (e.g., filename or placeholder)
  transcript: string;     // The full transcribed text
  words: OpenAIWord[];    // Array of words with adjusted timestamps
} 