import { IAiProvider, AiRequestOptions, AiResponse } from '../types/ai.types';
export declare class GeminiProvider implements IAiProvider {
    readonly providerName = "gemini";
    private modelName;
    constructor(modelName?: string);
    generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse>;
}
