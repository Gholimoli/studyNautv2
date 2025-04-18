import { 
  IAiProvider, 
  AiProviderType, 
  AiRequestOptions, 
  AiResponse, 
  AiStructuredContent, 
  aiStructuredContentSchema,
  AiTagResponse
} from '@/modules/ai/types/ai.types';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import * as dotenv from 'dotenv';
import { GENERATE_LESSON_STRUCTURE, GENERATE_TAGS } from './prompts/prompts';
import * as z from 'zod';

dotenv.config({ path: '../../.env' }); // Adjust path relative to dist/

// Define Zod schema for tag response validation
const aiTagResponseSchema = z.object({
  tags: z.array(z.string()).min(1).max(10), // Expect 1-10 string tags
});

const PRIMARY_PROVIDER_NAME = (process.env.PRIMARY_AI_PROVIDER || 'gemini') as AiProviderType;
const FALLBACK_PROVIDER_NAME = (process.env.FALLBACK_AI_PROVIDER || 'openai') as AiProviderType;

class AiService {
  private primaryProvider: IAiProvider;
  private fallbackProvider?: IAiProvider;

  constructor() {
    this.primaryProvider = this.createProvider(PRIMARY_PROVIDER_NAME);
    if (FALLBACK_PROVIDER_NAME && FALLBACK_PROVIDER_NAME !== PRIMARY_PROVIDER_NAME) {
      this.fallbackProvider = this.createProvider(FALLBACK_PROVIDER_NAME);
    }
    console.log(`[AiService] Initialized. Primary: ${this.primaryProvider.providerName}, Fallback: ${this.fallbackProvider?.providerName || 'None'}`);
  }

  private createProvider(providerName: AiProviderType): IAiProvider {
    switch (providerName.toLowerCase()) {
      case 'gemini':
      case 'gemini-1.5-flash':
      case 'gemini-2.0-flash': // Allow specific model names used in config
        return new GeminiProvider(providerName);
      case 'openai':
      case 'gpt-4o':
      case 'gpt-4o-mini': // Allow specific model names used in config
        return new OpenAiProvider(providerName);
      // Add cases for other providers later
      default:
        console.warn(`[AiService] Unsupported AI provider specified: ${providerName}. Defaulting to Gemini.`);
        return new GeminiProvider(); // Default fallback
    }
  }

  /**
   * Generates text content using the primary provider, with fallback if configured.
   */
  private async generateTextWithFallback(prompt: string, options?: AiRequestOptions): Promise<AiResponse> {
    console.log(`[AiService] Generating text using primary provider: ${this.primaryProvider.providerName}`);
    let response: AiResponse;
    try {
      response = await this.primaryProvider.generateText(prompt, options);
    } catch (error) {
        console.error(`[AiService] Primary provider ${this.primaryProvider.providerName} threw error:`, error);
        response = { content: null, errorMessage: (error instanceof Error ? error.message : 'Unknown error'), usage: undefined };
    }
    
    if (response.content === null && this.fallbackProvider) {
      console.warn(`[AiService] Primary provider failed (${response.errorMessage}). Trying fallback: ${this.fallbackProvider.providerName}`);
      try {
        response = await this.fallbackProvider.generateText(prompt, options);
      } catch (fallbackError) {
          console.error(`[AiService] Fallback provider ${this.fallbackProvider.providerName} threw error:`, fallbackError);
          response = { content: null, errorMessage: (fallbackError instanceof Error ? fallbackError.message : 'Unknown error'), usage: undefined };
      }
      if (response.content === null) {
         console.error(`[AiService] Fallback provider also failed (${response.errorMessage}).`);
      }
    }
    return response;
  }

  /**
   * Generates structured lesson content from source text.
   * Ensures the output conforms to the AiStructuredContent schema.
   */
  async generateLessonStructure(sourceText: string, languageCode: string = 'eng'): Promise<AiStructuredContent | null> {
    const promptTemplate = GENERATE_LESSON_STRUCTURE;
    const prompt = promptTemplate
        .replace('{SOURCE_TEXT}', sourceText)
        .replace(/{LANGUAGE_CODE}/g, languageCode); // Use global replace
    
    const options: AiRequestOptions = {
        jsonMode: true,
        temperature: 0.5, 
    };

    const response = await this.generateTextWithFallback(prompt, options);

    if (!response.content) {
      console.error('[AiService] Failed to generate lesson structure. No content received.', { error: response.errorMessage });
      return null;
    }

    try {
      // --- Clean potential markdown fences --- 
      let contentToParse = response.content.trim();
      const jsonFenceStart = '```json';
      const jsonFenceEnd = '```';

      if (contentToParse.startsWith(jsonFenceStart) && contentToParse.endsWith(jsonFenceEnd)) {
        console.log('[AiService] Removing JSON markdown fences for lesson structure...');
        contentToParse = contentToParse.substring(jsonFenceStart.length, contentToParse.length - jsonFenceEnd.length).trim();
      } else if (contentToParse.startsWith('```') && contentToParse.endsWith('```')) {
        // Handle generic fences just in case
        console.log('[AiService] Removing generic markdown fences for lesson structure...');
        contentToParse = contentToParse.substring(3, contentToParse.length - 3).trim();
      }
      // --- End cleaning ---

      if (!contentToParse) {
          console.error('[AiService] Content is empty after stripping fences for lesson structure.');
          return null;
      }

      const parsedJson = JSON.parse(contentToParse);
      const validatedData = aiStructuredContentSchema.safeParse(parsedJson);
      
      if (!validatedData.success) {
        console.error('[AiService] Failed to validate lesson structure schema:', validatedData.error.errors);
        console.error('[AiService] Invalid JSON content received:', response.content.substring(0, 500)); 
        return null;
      }
      
      console.log(`[AiService] Successfully generated and validated lesson structure: ${validatedData.data.title}`);
      return validatedData.data;

    } catch (error) {
      console.error('[AiService] Failed to parse lesson structure as JSON:', error);
      console.error('[AiService] Raw AI content:', response.content.substring(0, 500)); 
      return null;
    }
  }

  /**
   * Generates relevant subject tags for the given text content.
   * Returns an array of tag strings.
   */
  async generateTags(textContent: string, languageCode: string = 'eng'): Promise<string[]> {
    const MAX_TAG_INPUT_LENGTH = 5000;
    const truncatedText = textContent.substring(0, MAX_TAG_INPUT_LENGTH);
    
    const promptTemplate = GENERATE_TAGS(truncatedText); // GENERATE_TAGS returns a function, invoke it
    const prompt = promptTemplate.replace(/{LANGUAGE_CODE}/g, languageCode); // Use global replace

    const options: AiRequestOptions = {
      jsonMode: true,
      temperature: 0.3,
      maxOutputTokens: 100
    };

    console.log('[AiService] Generating tags...');
    const response = await this.generateTextWithFallback(prompt, options);

    if (!response.content) {
      console.error('[AiService] Failed to generate tags. No content received.', { error: response.errorMessage });
      return [];
    }

    try {
      // --- Clean potential markdown fences --- 
      let contentToParse = response.content.trim();
      const jsonFenceStart = '```json';
      const jsonFenceEnd = '```';

      if (contentToParse.startsWith(jsonFenceStart) && contentToParse.endsWith(jsonFenceEnd)) {
        console.log('[AiService] Removing JSON markdown fences for tags...');
        contentToParse = contentToParse.substring(jsonFenceStart.length, contentToParse.length - jsonFenceEnd.length).trim();
      } else if (contentToParse.startsWith('```') && contentToParse.endsWith('```')) {
        // Handle generic fences just in case
         console.log('[AiService] Removing generic markdown fences for tags...');
        contentToParse = contentToParse.substring(3, contentToParse.length - 3).trim();
      }
       // --- End cleaning ---

      if (!contentToParse) {
          console.error('[AiService] Content is empty after stripping fences for tags.');
          return [];
      }

      const parsedJson = JSON.parse(contentToParse);
      const validatedData = aiTagResponseSchema.safeParse(parsedJson);
      
      if (!validatedData.success) {
        console.error('[AiService] Failed to validate AI tag response schema:', validatedData.error.errors);
        console.error('[AiService] Invalid JSON content received for tags:', response.content.substring(0, 500)); 
        return [];
      }
      
      console.log(`[AiService] Successfully generated ${validatedData.data.tags.length} tags.`);
      return validatedData.data.tags;

    } catch (error) {
      console.error('[AiService] Failed to parse AI tag response as JSON:', error);
      console.error('[AiService] Raw AI content for tags:', response.content.substring(0, 500)); 
      return [];
    }
  }

  // TODO: Add methods for generateQuiz, generateFlashcards later
}

export const aiService = new AiService(); 