import { OpenAIWord } from '@shared/types/transcript.types';
interface ChunkMetadata {
    path: string;
    index: number;
    start: number;
    end: number;
}
interface TranscriptionResult {
    chunkIndex: number;
    words: OpenAIWord[];
}
/**
 * Placeholder function for processing specific audio chunks using OpenAI.
 * This should transcribe only the chunks provided in `failedChunksMetadata`.
 *
 * @param failedChunksMetadata Metadata of chunks that failed primary processing.
 * @param languageCode Optional language code.
 * @returns A promise resolving to an array of successful transcription results, or null.
 */
export declare function processSpecificAudioChunksWithOpenAI(failedChunksMetadata: ChunkMetadata[], languageCode?: string): Promise<TranscriptionResult[] | null>;
export {};
