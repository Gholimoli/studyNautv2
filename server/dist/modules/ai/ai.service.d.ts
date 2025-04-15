import { AiStructuredContent } from './types/ai.types';
declare class AiService {
    private primaryProvider;
    private fallbackProvider?;
    constructor();
    private createProvider;
    /**
     * Generates text content using the primary provider, with fallback if configured.
     */
    private generateTextWithFallback;
    /**
     * Generates structured lesson content from source text.
     * Ensures the output conforms to the AiStructuredContent schema.
     */
    generateLessonStructure(sourceText: string): Promise<AiStructuredContent | null>;
}
export declare const aiService: AiService;
export {};
