import { IAiProvider, AiRequestOptions, AiResponse } from '../types/ai.types';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../../.env' }); // Adjust path relative to dist

const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
// Default model from .env.example, can be overridden by env var
const DEFAULT_MODEL = process.env.PRIMARY_AI_PROVIDER || 'gemini-1.5-flash'; 

export class GeminiProvider implements IAiProvider {
  readonly providerName = 'gemini';
  private modelName: string;

  constructor(modelName?: string) {
    this.modelName = modelName || DEFAULT_MODEL;
    if (!API_KEY) {
      console.warn('[GeminiProvider] GEMINI_API_KEY environment variable not set. Provider will likely fail.');
    }
  }

  async generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse> {
    if (!API_KEY) {
      return { content: null, errorMessage: 'Gemini API key not configured.' };
    }

    const apiUrl = `${BASE_URL}/${this.modelName}:generateContent?key=${API_KEY}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // Map options to Gemini generationConfig
        ...(options?.temperature && { temperature: options.temperature }),
        ...(options?.maxOutputTokens && { maxOutputTokens: options.maxOutputTokens }),
        ...(options?.jsonMode && { responseMimeType: 'application/json' }),
        // Add other config mappings as needed (topP, topK, etc.)
      },
      // Add safetySettings if needed
    };

    try {
      console.log(`[GeminiProvider] Calling model ${this.modelName}...`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[GeminiProvider] API Error Response:', responseData);
        const errorMessage = responseData?.error?.message || `API request failed with status ${response.status}`;
        return { content: null, errorMessage };
      }

      // Extract content safely
      const generatedText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      
      // Extract usage data if available (structure might vary)
      const usage = responseData?.usageMetadata ? {
          promptTokens: responseData.usageMetadata.promptTokenCount || 0,
          completionTokens: responseData.usageMetadata.candidatesTokenCount || 0,
          totalTokens: responseData.usageMetadata.totalTokenCount || 0,
      } : undefined;

      console.log(`[GeminiProvider] Received response from ${this.modelName}.`);
      return { 
        content: generatedText,
        usage: usage,
      };

    } catch (error) {
      console.error('[GeminiProvider] Fetch Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown fetch error';
      return { content: null, errorMessage: `Failed to fetch Gemini API: ${message}` };
    }
  }

  // TODO: Implement generateVisual using direct API calls if needed later
} 