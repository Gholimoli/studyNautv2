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
        ...(options?.temperature && { temperature: options.temperature }),
        ...(options?.maxOutputTokens && { maxOutputTokens: options.maxOutputTokens }),
        ...(options?.jsonMode && { responseMimeType: 'application/json' }),
      },
    };

    // --- Detailed Logging ---
    const promptLength = prompt.length;
    const promptPreview = prompt.slice(0, 200) + (prompt.length > 200 ? '... [truncated]' : '');
    console.log('[GeminiProvider] --- Gemini API Request ---');
    console.log(`[GeminiProvider] Model: ${this.modelName}`);
    console.log(`[GeminiProvider] Prompt length: ${promptLength} chars`);
    console.log(`[GeminiProvider] Prompt preview:`, promptPreview);
    if (options?.maxOutputTokens) {
      console.log(`[GeminiProvider] maxOutputTokens: ${options.maxOutputTokens}`);
    }
    console.log('[GeminiProvider] Request body:', JSON.stringify(requestBody).slice(0, 1000) + (JSON.stringify(requestBody).length > 1000 ? '... [truncated]' : ''));
    // --- End Logging ---

    try {
      console.log(`[GeminiProvider] Calling model ${this.modelName}...`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('[GeminiProvider] Failed to parse response JSON:', parseErr);
        responseData = responseText;
      }

      if (!response.ok) {
        console.error('[GeminiProvider] API Error Response:', responseData);
        console.error(`[GeminiProvider] HTTP Status: ${response.status}`);
        return { content: null, errorMessage: responseData?.error?.message || `API request failed with status ${response.status}` };
      }

      const generatedText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      const usage = responseData?.usageMetadata ? {
          promptTokens: responseData.usageMetadata.promptTokenCount || 0,
          completionTokens: responseData.usageMetadata.candidatesTokenCount || 0,
          totalTokens: responseData.usageMetadata.totalTokenCount || 0,
      } : undefined;

      console.log(`[GeminiProvider] Received response from ${this.modelName}.`);
      if (usage) {
        console.log('[GeminiProvider] Usage:', usage);
      }
      return { 
        content: generatedText,
        usage: usage,
      };

    } catch (error) {
      console.error('[GeminiProvider] Fetch Error (full object):', error);
      if (error instanceof Error && error.stack) {
        console.error('[GeminiProvider] Error stack:', error.stack);
      }
      const message = error instanceof Error ? error.message : 'Unknown fetch error';
      return { content: null, errorMessage: `Failed to fetch Gemini API: ${message}` };
    }
  }

  // TODO: Implement generateVisual using direct API calls if needed later
} 