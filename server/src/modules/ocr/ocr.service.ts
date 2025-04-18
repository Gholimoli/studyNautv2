import { MistralOcrProvider } from './providers/mistral.provider';
import { GeminiOcrProvider } from './providers/gemini.provider';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';

dotenv.config();

const PRIMARY_OCR_PROVIDER = process.env.PRIMARY_OCR_PROVIDER || 'mistral';
const FALLBACK_OCR_PROVIDER = process.env.FALLBACK_OCR_PROVIDER || 'gemini';

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
      gemini: new GeminiOcrProvider(),
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
            await this.cleanupTempFile(file.path); // Cleanup on success before returning
            return result; // Early return on success
          }
          // Log if primary ran but returned no text or null, but DON'T set primaryError yet.
          if (result === null || (result && !result.text)) {
             console.warn(`[OcrService] Primary provider (${PRIMARY_OCR_PROVIDER}) returned null or no text. Will attempt fallback.`);
          }
        } catch (err) {
          primaryError = err; // Store ACTUAL error thrown by the primary provider
          console.error(`[OcrService] Primary provider (${PRIMARY_OCR_PROVIDER}) threw an error:`, err);
        }
      } else {
        // If no primary provider is configured, set an error to prevent proceeding without any attempt.
        console.error(`[OcrService] Primary provider '${PRIMARY_OCR_PROVIDER}' not configured or found.`);
        primaryError = new Error(`Primary OCR provider '${PRIMARY_OCR_PROVIDER}' not configured.`);
        // No fallback possible if primary isn't even configured, throw immediately.
        throw primaryError;
      }

      // --- Attempt Fallback Provider --- 
      // Trigger fallback if: 
      // 1. Primary threw an error (primaryError is set)
      // 2. OR Primary completed but returned null/no text (!result || !result.text)
      // FIX: Check for result before accessing result.text to avoid TypeError
      const calculatedShouldAttemptFallback = fallbackProvider && (primaryError || !result || (result && !result.text));

      // === DEBUG LOGS START ===
      console.log('[OcrService DEBUG] Preparing fallback check...');
      console.log('[OcrService DEBUG] primaryError:', primaryError);
      // Be careful logging full result object if it could be huge
      console.log('[OcrService DEBUG] result:', result ? { provider: result.provider, hasText: !!result.text } : result); 
      console.log('[OcrService DEBUG] fallbackProvider defined:', !!fallbackProvider);
      if(fallbackProvider) {
          console.log('[OcrService DEBUG] fallbackProvider name:', fallbackProvider.providerName);
      }
      console.log('[OcrService DEBUG] Calculated shouldAttemptFallback:', calculatedShouldAttemptFallback);
      // === DEBUG LOGS END ===

      if (calculatedShouldAttemptFallback) { 
        console.log(`[OcrService] Attempting fallback provider: ${FALLBACK_OCR_PROVIDER}`);
        try {
          // Ensure fileBuffer is not null before passing to fallback
          if (!fileBuffer) {
              throw new Error("Internal error: fileBuffer is null before fallback attempt.");
          }
          const fallbackResult = await fallbackProvider.process(fileBuffer, metadata, type);
          // Check if fallback succeeded *and* returned text
          if (fallbackResult && fallbackResult.text) {
            console.log(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) succeeded.`);
            await this.cleanupTempFile(file.path); // Cleanup on success
            return fallbackResult; // Return successful fallback result
          }
          // If fallback also gives no text or null
          console.warn(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) also returned null or no text.`);
          // Construct a more informative error if both failed
          let finalError = new Error(`Both primary (${PRIMARY_OCR_PROVIDER}) and fallback (${FALLBACK_OCR_PROVIDER}) OCR providers failed to return text.`);
          // If the primary provider threw a specific error, attach it for context
          if (primaryError instanceof Error) {
              (finalError as any).cause = primaryError; // Add original error as cause
              finalError.message += ` Primary error: ${primaryError.message}`;
          }
          throw finalError; 
        } catch (fallbackError) {
          console.error(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) threw an error:`, fallbackError);
          // If fallback failed, throw an error indicating both failed, including the fallback error
          // and the original primary error (if one exists) as causes.
          let finalError = new Error(`OCR failed. Primary (${PRIMARY_OCR_PROVIDER}) failed or returned no text, and Fallback (${FALLBACK_OCR_PROVIDER}) also failed.`);
          if (primaryError instanceof Error) {
             (finalError as any).primaryCause = primaryError; 
             finalError.message += ` Primary cause: ${primaryError.message}.`;
          }
          if (fallbackError instanceof Error) {
              (finalError as any).fallbackCause = fallbackError;
              finalError.message += ` Fallback cause: ${fallbackError.message}.`;
          }
          throw finalError; 
        }
      } else if (primaryError) {
          // If primary failed and no fallback was configured or attempted, throw the primary error
          throw primaryError;
      } else { 
          // Should not happen if logic is correct, but safeguard if primary succeeded without text and no fallback ran
          // === DEBUG LOGS START ===
          console.error('[OcrService DEBUG] Reached unexpected final else block.');
          console.error('[OcrService DEBUG] primaryError:', primaryError);
          console.error('[OcrService DEBUG] result:', result ? { provider: result.provider, hasText: !!result.text } : result);
          console.error('[OcrService DEBUG] fallbackProvider defined:', !!fallbackProvider);
          console.error('[OcrService DEBUG] calculatedShouldAttemptFallback was false.');
          // === DEBUG LOGS END ===
          throw new Error("OCR processing failed: Primary provider returned no text and no fallback was executed.");
      }

    } finally {
      // Ensure the original temporary file is deleted after all attempts, 
      // unless it was already deleted on success.
      // Check if file.path still exists before attempting unlink in finally, 
      // as successful returns might have already cleaned up.
      // The cleanupTempFile function handles ENOENT safely anyway.
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