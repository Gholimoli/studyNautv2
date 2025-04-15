import axios, { AxiosError } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import os from 'os'; // Needed for tmpdir
import crypto from 'crypto'; // Needed for unique filename
import FormData from 'form-data';
import { logger } from '@/core/logger/logger';
import { IOcrProvider, OcrResult } from '@/types/ocr.types';
import { AppError } from '@/core/errors/app.error';
import { config } from '@/core/config/config';
import mime from 'mime-types';

interface MistralOcrPage {
  index: number;
  markdown: string;
  images: {
    base64: string;
    mime_type: string;
  }[];
  dimensions: {
    dpi: number;
    height: number;
    width: number;
  };
}

interface MistralOcrResponse {
  pages: MistralOcrPage[];
}

interface MistralFile {
  id: string;
  bytes: number;
  created_at: number;
  filename: string;
  object: string;
  purpose: string;
  status: string;
  status_details: any;
}

interface MistralSignedUrl {
  url: string;
}

export class MistralOcrProvider implements IOcrProvider {
  readonly providerName = 'mistral';
  private apiKey: string;
  private baseUrl = 'https://api.mistral.ai/v1';

  constructor() {
    if (!config.mistralApiKey) {
      throw new AppError('Configuration Error', 'Mistral API key is not configured.');
    }
    this.apiKey = config.mistralApiKey;
  }

  async process(fileBuffer: Buffer, metadata: { originalname: string; mimetype: string }, type: 'pdf' | 'image'): Promise<OcrResult | null> {
    logger.info(`MistralOcrProvider: Processing ${type} file: ${metadata.originalname}`);
    let tempFilePath: string | null = null; // For PDF processing

    try {
      if (type === 'pdf') {
        // For PDFs, save buffer to temp file to use existing upload logic
        const tempDir = os.tmpdir();
        // Create a unique temporary filename
        const uniqueSuffix = crypto.randomBytes(6).toString('hex');
        tempFilePath = path.join(tempDir, `${uniqueSuffix}-${metadata.originalname}`);
        await fs.writeFile(tempFilePath, fileBuffer);
        logger.info(`MistralOcrProvider: Saved PDF buffer to temp file: ${tempFilePath}`);
        return await this.processPdf(tempFilePath); // Pass the path
      } else if (type === 'image') {
        // For images, use the buffer directly for base64
        return await this.processImageBase64(fileBuffer, metadata.mimetype); // Pass buffer and mimetype
      } else {
        logger.error(`MistralOcrProvider: Unsupported file type: ${type}`);
        return null;
      }
    } catch (error: unknown) { // Catch unknown error type
      logger.error('MistralOcrProvider: Error processing file', { name: metadata.originalname, error });
      // Type guard for AxiosError
      if (axios.isAxiosError(error)) {
        logger.error('Mistral API Error Details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
      } else if (error instanceof Error) { // Handle generic Errors
         logger.error('Mistral Processing Error:', { message: error.message, stack: error.stack });
      } else {
        // Handle other potential error types if necessary
         logger.error('Mistral Processing Error: Unknown error type occurred.');
      }
      return null; // Indicate failure for fallback
    } finally {
        // Cleanup temp file if it was created for PDF
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
                logger.info(`MistralOcrProvider: Deleted temp PDF file: ${tempFilePath}`);
            } catch (cleanupError) {
                logger.error(`MistralOcrProvider: Failed to delete temp PDF file: ${tempFilePath}`, { cleanupError });
            }
        }
    }
  }

  // --- PDF Processing Logic (Upload + Signed URL + Cleanup) ---
  private async processPdf(filePath: string): Promise<OcrResult | null> {
    const uploadedFile = await this.uploadFile(filePath);
    if (!uploadedFile) return null;
    logger.info(`MistralOcrProvider: PDF file uploaded, ID: ${uploadedFile.id}`);

    let signedUrl: MistralSignedUrl | null = null;
    try {
        signedUrl = await this.getSignedUrl(uploadedFile.id);
    } catch (getUrlError) {
        // Error getting URL, ensure cleanup before returning
        await this.deleteFile(uploadedFile.id);
        return null;
    }

    if (!signedUrl) {
        // No URL obtained, ensure cleanup
        await this.deleteFile(uploadedFile.id);
        return null;
    }
    logger.info(`MistralOcrProvider: Obtained signed URL for PDF.`);

    let ocrData: MistralOcrResponse | null = null;
    try {
        const response = await axios.post<MistralOcrResponse>(
          `${this.baseUrl}/ocr`,
          {
            model: 'mistral-ocr-latest',
            document: {
              type: 'document_url', // Correct type for signed URL PDF
              document_url: signedUrl.url,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 120000, // 2 minute timeout
          }
        );
        ocrData = response.data;
        logger.info(`MistralOcrProvider: PDF OCR successful.`);
    } catch (ocrError: unknown) { // Catch specific OCR error
        logger.error('MistralOcrProvider: Error during PDF OCR call', { ocrError });
         if (axios.isAxiosError(ocrError)) {
            logger.error('Mistral OCR API Error Details:', {
              status: ocrError.response?.status,
              data: ocrError.response?.data,
              message: ocrError.message,
            });
         } else if (ocrError instanceof Error) {
            logger.error('Mistral OCR Processing Error:', { message: ocrError.message });
         } else {
             logger.error('Mistral OCR Processing Error: Unknown error type occurred.');
         }
        // Fall through to cleanup
    } finally {
      // Ensure cleanup happens regardless of OCR success/failure
      await this.deleteFile(uploadedFile.id);
    }

    // Format result only if OCR was successful
    return ocrData ? this.formatResult(ocrData) : null;
  }

  // --- Image Processing Logic (Base64 Encoding) ---
  private async processImageBase64(fileBuffer: Buffer, mimeType: string): Promise<OcrResult | null> {
    const base64Image = fileBuffer.toString('base64');

    // Ensure it's a valid image MIME type for the data URI
    if (!mimeType.startsWith('image/')) {
        logger.error(`MistralOcrProvider: Invalid or unsupported image MIME type provided: ${mimeType}`);
        return null;
    }

    logger.info(`MistralOcrProvider: Image buffer encoded to base64 (MIME: ${mimeType}). Calling OCR endpoint.`);

    // No try/catch here, let the main `process` method handle errors
    const response = await axios.post<MistralOcrResponse>(
      `${this.baseUrl}/ocr`,
      {
        model: 'mistral-ocr-latest',
        document: {
          type: 'image_url', // Type for base64 image according to docs
          image_url: `data:${mimeType};base64,${base64Image}`, // Correct data URI format
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 60000, // 1 minute timeout for image
      }
    );

    logger.info(`MistralOcrProvider: Image OCR successful.`);
    return this.formatResult(response.data);
    // No file upload/delete needed for base64 approach
  }

  // --- Helper methods for PDF processing ---
  private async uploadFile(filePath: string): Promise<MistralFile | null> {
    const form = new FormData();
    // Use fs.readFile instead of opening a stream handle manually
    const fileContent = await fs.readFile(filePath);
    // Use path.basename for safety, although originalname might be better from metadata if available
    form.append('file', fileContent, path.basename(filePath));
    form.append('purpose', 'ocr');

    // No try/catch here, let the caller (processPdf -> process) handle errors
    const response = await axios.post<MistralFile>(
      `${this.baseUrl}/files`,
      form,
      {
        headers: {
          ...form.getHeaders(), // Keep this for FormData
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 60000, // 1 minute timeout for upload
      }
    );
    return response.data;
  }

  // Takes fileId
  private async getSignedUrl(fileId: string): Promise<MistralSignedUrl | null> {
    // Let the caller handle potential errors (processPdf -> process)
    const response = await axios.get<MistralSignedUrl>(
      `${this.baseUrl}/files/${fileId}/url`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );
    return response.data;
  }

  // Helper method to delete uploaded file for cleanup
  // Takes fileId
  private async deleteFile(fileId: string): Promise<void> {
      logger.info(`MistralOcrProvider: Attempting to delete uploaded file ${fileId}...`);
      try {
          await axios.delete(
              `${this.baseUrl}/files/${fileId}`,
              {
                  headers: { Authorization: `Bearer ${this.apiKey}` },
                  timeout: 30000,
              }
          );
          logger.info(`MistralOcrProvider: Successfully deleted file ${fileId}.`);
      } catch (error: unknown) {
          logger.error(`MistralOcrProvider: Failed to delete file ${fileId}`, { error });
          // Log details but don't throw, cleanup failure shouldn't prevent returning results if OCR succeeded before cleanup
          if (axios.isAxiosError(error)) {
              logger.error('Mistral Delete Error Details:', {
                  status: error.response?.status,
                  data: error.response?.data,
                  message: error.message,
              });
          } else if (error instanceof Error) {
              logger.error('Mistral Delete Processing Error:', { message: error.message });
          }
      }
  }
  // --- End Helper methods ---

  private formatResult(data: MistralOcrResponse | null): OcrResult | null {
    if (!data || !data.pages || data.pages.length === 0) {
      logger.warn('MistralOcrProvider: Received null or empty pages in OCR response.');
      return null;
    }
    // Combine markdown from all pages
    const combinedText = data.pages.map(page => page.markdown).join('\n\n---\n\n'); // Use standard markdown separator

    return {
      provider: this.providerName,
      text: combinedText,
    };
  }
} 