import { IAiProvider, AiRequestOptions, AiResponse } from '../types/ai.types';
export declare class OpenAiProvider implements IAiProvider {
    readonly providerName = "openai";
    private modelName;
    constructor(modelName?: string);
    generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse>;
}
