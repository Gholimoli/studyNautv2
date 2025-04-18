import axios, { AxiosError } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import { logger } from '@/core/logger/logger'; // Assuming logger is needed here
import { config } from '@/core/config/config'; // Import validated config
import { AppError } from '@/core/errors/app.error';

// --- Interfaces specific to Mistral API responses ---

export interface MistralOcrPage {
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

export interface MistralOcrResponse {
  pages: MistralOcrPage[];
}

export interface MistralFile {
  id: string;
  bytes: number;
  created_at: number;
  filename: string;
  object: string;
  purpose: string;
  status: string;
  status_details: any;
}

export interface MistralSignedUrl {
  url: string;
}


// --- Helper functions for interacting with Mistral /files API ---

const MISTRAL_API_BASE_URL = 'https://api.mistral.ai/v1';

/**
 * Uploads a file to the Mistral API.
 * Should be called within a try/catch block by the caller.
 * @param filePath Path to the local file.
 * @param apiKey Mistral API key.
 * @returns The MistralFile object or null on failure (logged by caller).
 */
export async function uploadFile(filePath: string, apiKey: string): Promise<MistralFile | null> {
  if (!apiKey) {
    throw new AppError('Configuration Error', 'Mistral API key is required for uploadFile.');
  }
  const form = new FormData();
  const fileContent = await fs.readFile(filePath);
  form.append('file', fileContent, path.basename(filePath));
  form.append('purpose', 'ocr');

  const response = await axios.post<MistralFile>(
    `${MISTRAL_API_BASE_URL}/files`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 60000, // 1 minute timeout for upload
    }
  );
  return response.data;
}

/**
 * Gets a signed URL for a previously uploaded Mistral file.
 * Should be called within a try/catch block by the caller.
 * @param fileId The ID of the uploaded file.
 * @param apiKey Mistral API key.
 * @returns The MistralSignedUrl object or null on failure (logged by caller).
 */
export async function getSignedUrl(fileId: string, apiKey: string): Promise<MistralSignedUrl | null> {
  if (!apiKey) {
    throw new AppError('Configuration Error', 'Mistral API key is required for getSignedUrl.');
  }
  const response = await axios.get<MistralSignedUrl>(
    `${MISTRAL_API_BASE_URL}/files/${fileId}/url`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000, // 30 second timeout
    }
  );
  return response.data;
}

/**
 * Deletes an uploaded file from Mistral. Handles its own errors internally for logging.
 * @param fileId The ID of the file to delete.
 * @param apiKey Mistral API key.
 */
export async function deleteFile(fileId: string, apiKey: string): Promise<void> {
  if (!apiKey) {
      logger.error(`MistralUtils: Cannot delete file ${fileId}, API key missing.`);
      return; // Don't throw, just log and return
  }
  logger.info(`MistralUtils: Attempting to delete uploaded file ${fileId}...`);
  try {
    await axios.delete(
      `${MISTRAL_API_BASE_URL}/files/${fileId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 30000,
      }
    );
    logger.info(`MistralUtils: Successfully deleted file ${fileId}.`);
  } catch (error: unknown) {
    logger.error(`MistralUtils: Failed to delete file ${fileId}`, { error });
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