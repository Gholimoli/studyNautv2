import { IAiProvider, AiProviderType, AiRequestOptions, AiResponse, AiStructuredContent, aiStructuredContentSchema } from './types/ai.types';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import * as dotenv from 'dotenv';
import { GENERATE_LESSON_STRUCTURE } from './prompts/prompts';

dotenv.config({ path: '../../.env' }); // Adjust path relative to dist/

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
    let response = await this.primaryProvider.generateText(prompt, options);

    if (response.content === null && this.fallbackProvider) {
      console.warn(`[AiService] Primary provider failed (${response.errorMessage}). Trying fallback: ${this.fallbackProvider.providerName}`);
      response = await this.fallbackProvider.generateText(prompt, options);
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
  async generateLessonStructure(sourceText: string): Promise<AiStructuredContent | null> {
    // Format the prompt with the source text
    const prompt = GENERATE_LESSON_STRUCTURE.replace('{SOURCE_TEXT}', sourceText);
    
    const options: AiRequestOptions = {
        jsonMode: true,
        temperature: 0.5, 
        // Consider adding maxOutputTokens based on expected structure size
    };

    const response = await this.generateTextWithFallback(prompt, options);

    if (!response.content) {
      console.error('[AiService] Failed to generate lesson structure. No content received.', { error: response.errorMessage });
      return null;
    }

    try {
      const parsedJson = JSON.parse(response.content);
      const validatedData = aiStructuredContentSchema.safeParse(parsedJson);
      
      if (!validatedData.success) {
        console.error('[AiService] Failed to validate AI response schema:', validatedData.error.errors);
        console.error('[AiService] Invalid JSON content received:', response.content.substring(0, 500)); 
        return null;
      }
      
      console.log(`[AiService] Successfully generated and validated lesson structure: ${validatedData.data.title}`);
      return validatedData.data;

    } catch (error) {
      console.error('[AiService] Failed to parse AI response as JSON:', error);
      console.error('[AiService] Raw AI content:', response.content.substring(0, 500)); 
      return null;
    }
  }

  // TODO: Add methods for generateQuiz, generateFlashcards later
}

export const aiService = new AiService(); 