import axios, { AxiosError } from 'axios';
import { IOcrProvider } from '../../../types/ocr.types';
import type { OcrResult } from '@shared/types/ocr.types';
import { AppError } from '@/core/errors/app.error';
import { logger } from '@/core/logger/logger';
import { config } from '@/core/config/config';

// Gemini API configuration
const GEMINI_API_ENDPOINT = 
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export class GeminiOcrProvider implements IOcrProvider {
  public readonly providerName = 'gemini';
  private readonly apiKey: string;
  private readonly modelName = 'gemini-2.0-flash';

  constructor() {
    this.apiKey = config.ai.geminiApiKey!;
    if (!this.apiKey) {
      throw new AppError(
        'Configuration Error',
        'Gemini API key is missing. Please set GEMINI_API_KEY environment variable.'
      );
    }
  }

  async process(
    fileBuffer: Buffer,
    metadata: { originalname: string; mimetype: string },
    type: 'pdf' | 'image' // Type might be used for specific prompting if needed
  ): Promise<OcrResult | null> {
    logger.info(`GeminiOcrProvider: Starting OCR process for ${metadata.originalname}...`);

    const base64Data = fileBuffer.toString('base64');
    const mimeType = metadata.mimetype;

    // Construct the request payload for Gemini API
    const requestPayload = {
      contents: [
        {
          parts: [
            { text: "Extract all text content from the following document:" },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      // Optional: Add generationConfig if needed (e.g., temperature)
      // generationConfig: {
      //   temperature: 0.1, 
      // }
    };

    try {
      logger.info(`Calling Gemini API endpoint: ${this.modelName}`);
      const response = await axios.post(
        `${GEMINI_API_ENDPOINT}?key=${this.apiKey}`,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5 minutes timeout
        }
      );

      // --- Response Parsing (Important: Structure may vary) ---
      // Gemini's response structure needs careful handling.
      // Assuming the text is within response.data.candidates[0].content.parts[0].text
      const candidates = response.data?.candidates;
      if (!candidates || candidates.length === 0 || !candidates[0].content?.parts || candidates[0].content.parts.length === 0) {
        logger.warn('Gemini OCR response missing expected text structure', { responseData: response.data });
        throw new AppError('OCR Provider Error', 'Gemini API response did not contain expected content structure.');
      }
      
      // Concatenate text from all parts, just in case
      const extractedText = candidates[0].content.parts.map((part: any) => part.text || '').join('\n');
      
      if (!extractedText.trim()) {
           logger.warn(`Gemini OCR for ${metadata.originalname} resulted in empty text.`);
           // Consider if empty text is an error or valid result
      }

      logger.info(`Gemini OCR processing completed for ${metadata.originalname}.`);
      return {
        text: extractedText || '',
        provider: this.providerName,
      };
    } catch (error: unknown) {
      logger.error('Gemini OCR API call failed', { filename: metadata.originalname, error });

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>; // Use any for potentially varied error structures
        const errorMessage = axiosError.response?.data?.error?.message || axiosError.message;
        logger.error('Gemini OCR Error Details:', {
          status: axiosError.response?.status,
          data: JSON.stringify(axiosError.response?.data, null, 2),
          message: errorMessage,
        });
        throw new AppError(
          'OCR Provider Error',
          `Gemini API request failed (${axiosError.response?.status || 'Unknown Status'}): ${errorMessage}`
        );
      } else {
        throw new AppError(
          'OCR Provider Error',
          `An unexpected error occurred during Gemini OCR call: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }
} 