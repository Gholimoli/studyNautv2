export interface ChunkMetadata {
    path: string;
    index: number;
    start: number;
    end: number;
}
/**
 * Create a temporary directory for chunk files.
 */
export declare function createTempDir(): Promise<string>;
/**
 * Recursively remove a temporary directory.
 */
export declare function cleanupTempDir(dirPath: string): Promise<void>;
/**
 * Split an audio file into chunks of approximately CHUNK_SIZE_MB, clamped to min/max duration.
 */
export declare function createChunks(audioFilePath: string, tempDir: string): Promise<ChunkMetadata[]>;
