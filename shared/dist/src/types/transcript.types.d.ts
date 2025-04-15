/**
 * Represents a single word with timing information.
 * Using a structure compatible with OpenAI's verbose_json response for fallback consistency.
 */
export interface OpenAIWord {
    word: string;
    start: number;
    end: number;
}
/**
 * Represents the structure of the response from ElevenLabs' speech-to-text API
 * when word timestamps are requested.
 */
export interface ElevenLabsTranscriptionResponse {
    words: {
        word: string;
        start_time: number;
        end_time: number;
    }[];
}
/**
 * Represents the final combined transcript data after processing.
 */
export interface TranscriptData {
    title: string;
    transcript: string;
    words: OpenAIWord[];
}
//# sourceMappingURL=transcript.types.d.ts.map