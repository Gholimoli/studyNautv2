import { MistralOcrProvider } from './providers/mistral.provider';
import { OpenAIOcrProvider } from './providers/openai.provider';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';

dotenv.config();

const PRIMARY_OCR_PROVIDER = process.env.PRIMARY_OCR_PROVIDER || 'mistral';
const FALLBACK_OCR_PROVIDER = process.env.FALLBACK_OCR_PROVIDER || 'openai';

// Define types locally for now
export interface OCRResult {
  text: string;
  provider: string;
  meta?: any;
}
interface IOcrProvider {
  providerName: string;
  process(fileBuffer: Buffer, metadata: { originalname: string; mimetype: string }, type: 'pdf' | 'image'): Promise<OCRResult | null>;
}

class OcrService {
  private providers: Record<string, IOcrProvider>;

  constructor() {
    this.providers = {
      mistral: new MistralOcrProvider(),
      openai: new OpenAIOcrProvider(),
    };
  }

  async processFile(file: Express.Multer.File, type: 'pdf' | 'image'): Promise<OCRResult> {
    const primaryProvider = this.providers[PRIMARY_OCR_PROVIDER];
    const fallbackProvider = this.providers[FALLBACK_OCR_PROVIDER];
    let result: OCRResult | null = null;
    let primaryError: any = null;
    let fileBuffer: Buffer | null = null;

    try {
      // Read file buffer
      try {
        fileBuffer = await fs.readFile(file.path);
        console.log(`[OcrService] Read file buffer for ${file.originalname}, size: ${fileBuffer.length}`);
      } catch (readError) {
        console.error(`[OcrService] Failed to read file ${file.path}:`, readError);
        throw new Error(`Failed to read uploaded file: ${file.originalname}`); // No cleanup needed here, file read failed
      }

      const metadata = { originalname: file.originalname, mimetype: file.mimetype };

      // Attempt Primary Provider
      if (primaryProvider) {
        try {
          console.log(`[OcrService] Attempting primary provider: ${PRIMARY_OCR_PROVIDER}`);
          result = await primaryProvider.process(fileBuffer, metadata, type);
          // Check if primary succeeded *and* returned text
          if (result && result.text) {
            console.log(`[OcrService] Primary provider (${PRIMARY_OCR_PROVIDER}) succeeded.`);
            return result; // Early return on success
          }
          // If primary ran but returned no text or null, set an error to trigger fallback
          if (result === null || (result && !result.text)) {
             console.warn(`[OcrService] Primary provider (${PRIMARY_OCR_PROVIDER}) returned no text or null result.`);
             primaryError = new Error(`Primary provider (${PRIMARY_OCR_PROVIDER}) returned no text or null result.`);
          }
        } catch (err) {
          primaryError = err; // Store actual error from primary provider
          console.error(`[OcrService] Primary provider (${PRIMARY_OCR_PROVIDER}) failed execution:`, err);
        }
      } else {
        // If no primary provider is configured, treat it as an error to potentially trigger fallback
        console.warn(`[OcrService] Primary provider '${PRIMARY_OCR_PROVIDER}' not configured or found.`);
        primaryError = new Error(`Primary OCR provider '${PRIMARY_OCR_PROVIDER}' not configured.`);
      }

      // Attempt Fallback Provider (only if primary failed OR returned no text)
      if (fallbackProvider && primaryError) { 
        console.log(`[OcrService] Attempting fallback provider: ${FALLBACK_OCR_PROVIDER}`);
        try {
          result = await fallbackProvider.process(fileBuffer, metadata, type);
          // Check if fallback succeeded *and* returned text
          if (result && result.text) {
            console.log(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) succeeded.`);
            return result; // Return successful fallback result
          }
          // If fallback also gives no text, throw the original primary error
          console.warn(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) also returned no text or null result.`);
          throw primaryError; 
        } catch (fallbackError) {
          console.error(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) failed execution:`, fallbackError);
          // Throw the *original* primary error for better context, not the fallback error
          throw primaryError; 
        }
      }

      // If we reach here:
      // - Primary failed/gave no text, AND no fallback was configured/attempted.
      // - OR Primary failed/gave no text, Fallback ran but also failed/gave no text.
      if (primaryError) {
        // If primary failed, throw that error.
        throw primaryError; 
      } else {
        // This case should ideally not be reached if primary ran successfully but without text,
        // as primaryError would be set. But as a safeguard:
        throw new Error('OCR processing completed, but no provider returned text.');
      }

    } finally {
      // Ensure the original temporary file is deleted after all attempts
      await this.cleanupTempFile(file.path);
    }
  } // End processFile

  // Private helper to cleanup temp file
  private async cleanupTempFile(filePath: string | undefined): Promise<void> {
    if (!filePath) return;
    try {
      await fs.unlink(filePath);
      console.log(`[OcrService] Deleted temporary file: ${filePath}`);
    } catch (unlinkError: any) {
      // Log error but don't throw, as it shouldn't mask the main processing result/error
      if (unlinkError.code !== 'ENOENT') { // Don't log if file already gone
           console.error(`[OcrService] Failed to delete temporary file ${filePath}:`, unlinkError);
      }
    }
  }

} // End OcrService

export const ocrService = new OcrService(); 