import axios, { AxiosError } from 'axios';
// Import OcrResult from shared types and IOcrProvider from local
import { IOcrProvider } from '../../../types/ocr.types'; // Local interface definition
import type { OcrResult } from '@shared/types/ocr.types'; // Actual result type from shared
import { AppError } from '@/core/errors/app.error';
import { logger } from '@/core/logger/logger';
import { config } from '@/core/config/config';
import { promises as fs } from 'fs'; // Keep for temp file handling if needed
import path from 'path'; // Keep for temp file handling if needed
import * as os from 'os'; // Keep for temp file handling if needed
import { v4 as uuidv4 } from 'uuid'; // Keep for temp file handling if needed
// Utility functions (still needed for upload/URL flow)
import {
  uploadFile,
  getSignedUrl,
  deleteFile,
  MistralOcrResponse,
  MistralFile
} from './mistral.utils';
// Remove file-type import - not needed with new signature
// import { fileTypeFromBuffer } from 'file-type';
import FormData from 'form-data'; // Keep for potential direct buffer upload? Or remove if only using data_uri/file_url
import type { MistralOcrResponse as MistralOcrResponseType } from './mistral.utils'; // Keep response type import

const MISTRAL_API_BASE_URL = 'https://api.mistral.ai/v1';

export class MistralOcrProvider implements IOcrProvider {
  public readonly providerName = 'mistral';
  private readonly apiKey: string;
  private readonly modelId: string; // Keep modelId
  private readonly maxFileSize = 10 * 1024 * 1024; // 10 MB limit

  constructor() {
    this.apiKey = config.ai.mistralApiKey!;
    // Use hardcoded default since mistralOcrModel is not in config type
    this.modelId = 'mistral-ocr-standard';
    if (!this.apiKey) {
      throw new AppError(
        'Configuration Error',
        'Mistral API key is missing. Please set MISTRAL_API_KEY environment variable.'
      );
    }
  }

  // Updated process method signature to match IOcrProvider
  async process(
    fileBuffer: Buffer,
    metadata: { originalname: string; mimetype: string },
    type: 'pdf' | 'image' // Type might be redundant now
  ): Promise<OcrResult | null> {
    logger.info('MistralOcrProvider: Starting OCR process...', { filename: metadata.originalname, mimetype: metadata.mimetype });

    // Validate buffer size
    if (fileBuffer.byteLength > this.maxFileSize) {
        logger.warn(`File buffer exceeds max size (${this.maxFileSize} bytes): ${metadata.originalname}`);
        throw new AppError('File Too Large', `File exceeds the ${this.maxFileSize / (1024 * 1024)}MB size limit.`);
    }

    try {
        // Use direct buffer for PDF, data_uri for images
        if (metadata.mimetype === 'application/pdf') {
            logger.info('Processing PDF buffer via direct API call...');
            const ocrResponse = await this.callMistralOcrWithBuffer(fileBuffer, 'application/pdf');
            return this.formatResult(ocrResponse);
        } else if (metadata.mimetype.startsWith('image/')) {
            logger.info('Processing image buffer via data URI...');
            return await this.processImageBuffer(fileBuffer, metadata.mimetype);
        } else {
            logger.error('MistralOcrProvider: Unsupported mime type provided', { mimetype: metadata.mimetype });
            throw new AppError(
                'Unsupported Input',
                `Mistral OCR Provider received an unsupported mime type: ${metadata.mimetype}`
            );
        }
    } catch (error) {
        logger.error('Error during Mistral OCR processing, returning null to allow fallback.', {
          filename: metadata.originalname,
          error: error instanceof Error ? error.message : String(error)
        });
        // Return null to signal failure and allow OcrService to try the fallback provider.
        return null;
    }
  }

  // Renamed: Central method to call the Mistral OCR endpoint with JSON PAYLOAD
  private async callMistralOcrWithPayload(
    payload: { file_url?: string; data_uri?: string }
  ): Promise<MistralOcrResponseType> {
    try {
      logger.info('Calling Mistral /ocr endpoint with JSON payload...', { model: this.modelId, hasUrl: !!payload.file_url, hasDataUri: !!payload.data_uri });
      const response = await axios.post<MistralOcrResponseType>(
        `${MISTRAL_API_BASE_URL}/ocr`,
        { ...payload, model: this.modelId }, // Include model ID
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 300000, // 5 minutes timeout
        }
      );
      logger.info('Mistral OCR call with payload successful.');
      return response.data;
    } catch (error: unknown) {
        logger.error('Mistral OCR API call with payload failed', { error });
        // Keep existing detailed error handling
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<{ message?: string; detail?: any } | string>; // Add optional detail field
            const responseData = axiosError.response?.data;
            const errorMessage = typeof responseData === 'object' && responseData?.message
                                ? responseData.message
                                : typeof responseData === 'string'
                                ? responseData
                                : axiosError.message;
            // Log the full response data for more details, especially for 422 errors
            logger.error('Mistral OCR Error Details:', {
                status: axiosError.response?.status,
                data: JSON.stringify(responseData, null, 2), // Stringify data for better logging
                message: errorMessage,
            });
            throw new AppError(
                'OCR Provider Error',
                `Mistral API request failed (${axiosError.response?.status || 'Unknown Status'}): ${errorMessage}`
            );
        } else {
            throw new AppError(
                'OCR Provider Error',
                `An unexpected error occurred during Mistral OCR call: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
  }

  // NEW: Method to call Mistral OCR endpoint with raw file BUFFER
  private async callMistralOcrWithBuffer(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<MistralOcrResponseType> {
    try {
      logger.info('Calling Mistral /ocr endpoint with raw buffer...', { model: this.modelId, mimeType: mimeType, size: fileBuffer.length });
      const response = await axios.post<MistralOcrResponseType>(
        `${MISTRAL_API_BASE_URL}/ocr`,
        fileBuffer, // Send buffer directly as request body
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': mimeType, // Set correct Content-Type for the file
            Accept: 'application/json',
            // Consider adding model ID via header if API supports it, e.g.:
            // 'X-Mistral-Model-Id': this.modelId 
          },
          timeout: 300000, // 5 minutes timeout
          // Ensure Axios sends buffer correctly (usually default, but check if issues)
          // transformRequest: [(data, headers) => data], 
        }
      );
      logger.info('Mistral OCR call with buffer successful.');
      return response.data;
    } catch (error: unknown) {
       // Reuse the same detailed error handling as the payload method
        logger.error('Mistral OCR API call with buffer failed', { error });
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<{ message?: string; detail?: any } | string>;
            const responseData = axiosError.response?.data;
            const errorMessage = typeof responseData === 'object' && responseData?.message ? responseData.message : typeof responseData === 'string' ? responseData : axiosError.message;
            logger.error('Mistral OCR Error Details:', { status: axiosError.response?.status, data: JSON.stringify(responseData, null, 2), message: errorMessage });
            throw new AppError('OCR Provider Error', `Mistral API request failed (${axiosError.response?.status || 'Unknown Status'}): ${errorMessage}`);
        } else {
            throw new AppError('OCR Provider Error', `An unexpected error occurred during Mistral OCR call: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
  }

  // REMAINS: Method to handle image buffer using data URI
  private async processImageBuffer(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<OcrResult> {
    try {
        const base64Data = fileBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64Data}`;
        logger.info('Prepared data URI for Mistral image OCR.');
        // Use the payload method for data_uri
        const ocrResponse = await this.callMistralOcrWithPayload({ data_uri: dataUri });
        return this.formatResult(ocrResponse);
    } catch (error: unknown) {
      logger.error('Error during Mistral image buffer processing', { mimeType, error });
      if (error instanceof AppError) {
        throw error;
      } else {
        throw new AppError(
          'OCR Processing Error',
          `An unexpected error occurred during image processing: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Helper to format the Mistral response into the standard OcrResult
  private formatResult(mistralResponse: MistralOcrResponseType): OcrResult {
    // Basic check if response structure is valid
    if (!mistralResponse || !Array.isArray(mistralResponse.pages)) {
        logger.error('Invalid Mistral OCR response structure received', { response: mistralResponse });
        throw new AppError('OCR Provider Error', 'Received invalid response structure from Mistral OCR.');
    }

    const combinedText = mistralResponse.pages
      .map((page) => page.markdown) // Assuming markdown contains the text
      .join('\n\n---\n\n'); // Separate pages clearly

    logger.info(
      `Mistral OCR processing completed. Extracted text from ${mistralResponse.pages.length} pages.`
    );
    return {
      text: combinedText,
      // Include raw pages if needed for specific use cases or debugging
      // rawResult: mistralResponse, // Optional: include the raw provider response
      provider: this.providerName, // Use the class property
    };
  }
}
