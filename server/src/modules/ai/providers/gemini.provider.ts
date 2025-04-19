import axios, { AxiosError } from 'axios';
import { IAiProvider, AiRequestOptions, AiResponse } from '@/modules/ai/types/ai.types';
import { config } from '@/core/config/config'; // Import validated config
import { AppError } from '@/core/errors/app.error';
import { logger } from '@/core/logger/logger';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash'; // Use Flash 2 as default
const DEFAULT_VISION_MODEL = 'gemini-pro-vision'; // Or your actual default vision model

export class GeminiProvider implements IAiProvider {
    readonly providerName = 'gemini';
    private modelName: string;
    private visionModelName: string;
    private apiKey: string; // Store API key from config

  constructor(modelName?: string, visionModelName?: string) {
    // Use the consistent config property for the Gemini API key
    const key = config.ai.geminiApiKey;
    if (!key) {
      // Log warning but don't throw immediately, allow instantiation
      logger.warn('[GeminiProvider] GEMINI_API_KEY not found in config. Provider will likely fail.');
      // Throw error here if API key is strictly required for instantiation
      throw new AppError(
          'Configuration Error',
          'Gemini API key is missing. Please set GEMINI_API_KEY environment variable.'
      );
    }
    this.apiKey = key;
    this.modelName = modelName || DEFAULT_MODEL;
    this.visionModelName = visionModelName || DEFAULT_VISION_MODEL; 
    logger.info(`GeminiProvider initialized with model: ${this.modelName}, vision model: ${this.visionModelName}`);
  }

  async generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse> {
    if (!this.apiKey) {
        logger.error('[GeminiProvider] Attempted generateText without API key configured.');
        // Return structure indicating configuration error
        return { 
             content: null, 
             errorMessage: 'Gemini API key not configured.'
        }; 
    }

    const apiUrl = `${BASE_URL}/${this.modelName}:generateContent?key=${this.apiKey}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            ...(options?.temperature && { temperature: options.temperature }),
        }
    };

    try {
      logger.info(`Calling Gemini API (${this.modelName}) for text generation...`);
      const response = await axios.post(apiUrl, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000, // Use default 60s timeout
      });

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      if (!content) {
          logger.warn('Gemini API response missing expected text content.', { data: response.data });
      }

      return { content: content };
    } catch (error) {
      logger.error(`Gemini API (${this.modelName}) text generation failed:`, { error });
      const errorMessage = this.parseErrorMessage(error);
      return { 
          content: null, 
          errorMessage: errorMessage
       };
    }
  }

  // Add other methods like generateVisual, handle multimodal if needed

  // Helper to parse error messages (can be reused)
  private parseErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>; 
      const backendError = axiosError.response?.data?.error;
      return (
        `Gemini API Error (${axiosError.response?.status}): ${backendError?.message || axiosError.message}`
      );
    } else if (error instanceof Error) {
      return error.message;
    } else {
      return 'Unknown Gemini provider error';
    }
  }
} 