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
    type: 'pdf' | 'image' // Type parameter might be redundant if we rely on mimetype
  ): Promise<OcrResult | null> { // Return null on failure as per interface possibility
    logger.info('MistralOcrProvider: Starting OCR process...', { filename: metadata.originalname, mimetype: metadata.mimetype, type });

    // Validate buffer size
    if (fileBuffer.byteLength > this.maxFileSize) {
        logger.warn(`File buffer exceeds max size (${this.maxFileSize} bytes): ${metadata.originalname}`);
        throw new AppError('File Too Large', `File exceeds the ${this.maxFileSize / (1024 * 1024)}MB size limit.`);
    }

    try {
        // Mistral API prefers data_uri for images and file_url for PDFs
        // Let's try using data_uri for images directly
        if (metadata.mimetype.startsWith('image/')) {
            logger.info('Processing image buffer via data URI...');
            return await this.processImageBuffer(fileBuffer, metadata.mimetype);
        } else if (metadata.mimetype === 'application/pdf') {
            logger.info('Processing PDF buffer via file upload flow...');
            // Need to write buffer to a temp file to use the existing upload/URL flow
            return await this.processPdfBuffer(fileBuffer, metadata.originalname);
        } else {
            logger.error('MistralOcrProvider: Unsupported mime type provided', { mimetype: metadata.mimetype });
            throw new AppError(
                'Unsupported Input',
                `Mistral OCR Provider received an unsupported mime type: ${metadata.mimetype}`
            );
        }
    } catch (error) {
        logger.error('Error during Mistral OCR processing', { filename: metadata.originalname, error });
        // Return null or rethrow AppError based on desired handling
         if (error instanceof AppError) {
             throw error; // Rethrow known AppErrors
         } else {
            // Log unexpected errors but potentially return null as per interface? Or throw generic AppError?
            // Let's throw for now to indicate failure clearly.
             throw new AppError(
                 'OCR Processing Error',
                 `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
             );
         }
         // return null; // Alternative: return null on failure
    }
  }

  // Central method to call the Mistral OCR endpoint
  private async callMistralOcr(
    payload: { file_url?: string; data_uri?: string }
  ): Promise<MistralOcrResponse> {
    try {
      logger.info('Calling Mistral /ocr endpoint...', { model: this.modelId, hasUrl: !!payload.file_url, hasDataUri: !!payload.data_uri });
      const response = await axios.post<MistralOcrResponse>(
        `${MISTRAL_API_BASE_URL}/ocr`,
        // Include model ID if the API supports it in the payload
        { ...payload, model: this.modelId },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 300000, // 5 minutes timeout
        }
      );
      logger.info('Mistral OCR call successful.');
      return response.data;
    } catch (error: unknown) {
        logger.error('Mistral OCR API call failed', { error });
        // Keep existing detailed error handling
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<{ message?: string } | string>;
            const errorMessage = typeof axiosError.response?.data === 'object' && axiosError.response.data?.message
                                ? axiosError.response.data.message
                                : typeof axiosError.response?.data === 'string'
                                ? axiosError.response.data
                                : axiosError.message;
            logger.error('Mistral OCR Error Details:', {
                status: axiosError.response?.status,
                data: axiosError.response?.data,
                message: errorMessage,
            });
            throw new AppError(
                'OCR Provider Error',
                `Mistral API request failed (${axiosError.response?.status}): ${errorMessage}`
            );
        } else {
            throw new AppError(
                'OCR Provider Error',
                `An unexpected error occurred during Mistral OCR call: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
  }

  // Refactored to handle PDF buffer by writing to temp file
  private async processPdfBuffer(fileBuffer: Buffer, originalFilename: string): Promise<OcrResult> {
    let tempFilePath: string | null = null;
    let uploadedFile: MistralFile | null = null;
    try {
      // 1. Create a temporary file from the buffer
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'studynaut-ocr-pdf-'));
      // Use a safe filename, maybe based on original or UUID
      const safeFilename = originalFilename.replace(/[^a-zA-Z0-9.]/g, '_') || `${uuidv4()}.pdf`;
      tempFilePath = path.join(tempDir, safeFilename);
      await fs.writeFile(tempFilePath, fileBuffer);
      logger.info(`Created temporary PDF file: ${tempFilePath}`);

      // 2. Upload the temporary file using the utility function
      logger.info(`Uploading temporary PDF file to Mistral...`);
      uploadedFile = await uploadFile(tempFilePath, this.apiKey);
      if (!uploadedFile) {
        throw new AppError('OCR Provider Error', 'Failed to upload PDF file to Mistral.');
      }
      logger.info(`PDF file uploaded successfully: ID ${uploadedFile.id}`);

      // 3. Get the signed URL using the utility function
      logger.info(`Getting signed URL for file ID ${uploadedFile.id}...`);
      const signedUrlData = await getSignedUrl(uploadedFile.id, this.apiKey);
      if (!signedUrlData?.url) {
        throw new AppError(
          'OCR Provider Error',
          'Failed to get signed URL from Mistral for PDF.'
        );
      }
      logger.info(`Got signed URL successfully for PDF.`);

      // 4. Call the Mistral OCR endpoint with the signed URL
      const ocrResponse = await this.callMistralOcr({ file_url: signedUrlData.url });

      // 5. Format and return the result
      return this.formatResult(ocrResponse);

    } catch (error: unknown) {
        logger.error('Error during Mistral PDF buffer processing', { error, originalFilename });
        // Re-throw error after potential cleanup attempt
        if (error instanceof AppError) {
            throw error;
        } else {
            throw new AppError(
                'OCR Processing Error',
                `An unexpected error occurred during PDF processing: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    } finally {
      // Cleanup is crucial for temp files
      if (uploadedFile?.id) {
        // Don't await deleteFile here, let it run in background potentially
        deleteFile(uploadedFile.id, this.apiKey);
      }
      if (tempFilePath) {
        try {
          const tempDir = path.dirname(tempFilePath);
          await fs.rm(tempDir, { recursive: true, force: true });
          logger.info(`Cleaned up temporary PDF directory: ${tempDir}`);
        } catch (cleanupError) {
          logger.warn(`Failed to clean up temporary PDF file/directory: ${tempFilePath}`, {
            error: cleanupError,
          });
        }
      }
    }
  }

  // New method to handle image buffer using data URI
  private async processImageBuffer(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<OcrResult> {
    try {
        // Construct the data URI
        const base64Data = fileBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64Data}`;
        logger.info('Prepared data URI for Mistral image OCR.');

        // Call the Mistral OCR endpoint with the data URI
        const ocrResponse = await this.callMistralOcr({ data_uri: dataUri });

        // Format and return the result
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
  private formatResult(mistralResponse: MistralOcrResponse): OcrResult {
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
