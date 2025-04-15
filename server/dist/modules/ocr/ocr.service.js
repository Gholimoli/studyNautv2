"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrService = void 0;
const mistral_provider_1 = require("./providers/mistral.provider");
const openai_provider_1 = require("./providers/openai.provider");
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs/promises"));
dotenv.config();
const PRIMARY_OCR_PROVIDER = process.env.PRIMARY_OCR_PROVIDER || 'mistral';
const FALLBACK_OCR_PROVIDER = process.env.FALLBACK_OCR_PROVIDER || 'openai';
class OcrService {
    constructor() {
        this.providers = {
            mistral: new mistral_provider_1.MistralOcrProvider(),
            openai: new openai_provider_1.OpenAIOcrProvider(),
        };
    }
    processFile(file, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const primaryProvider = this.providers[PRIMARY_OCR_PROVIDER];
            const fallbackProvider = this.providers[FALLBACK_OCR_PROVIDER];
            let result = null;
            let primaryError = null;
            let fileBuffer = null;
            try {
                // Read file buffer
                try {
                    fileBuffer = yield fs.readFile(file.path);
                    console.log(`[OcrService] Read file buffer for ${file.originalname}, size: ${fileBuffer.length}`);
                }
                catch (readError) {
                    console.error(`[OcrService] Failed to read file ${file.path}:`, readError);
                    throw new Error(`Failed to read uploaded file: ${file.originalname}`); // No cleanup needed here, file read failed
                }
                const metadata = { originalname: file.originalname, mimetype: file.mimetype };
                // Attempt Primary Provider
                if (primaryProvider) {
                    try {
                        console.log(`[OcrService] Attempting primary provider: ${PRIMARY_OCR_PROVIDER}`);
                        result = yield primaryProvider.process(fileBuffer, metadata, type);
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
                    }
                    catch (err) {
                        primaryError = err; // Store actual error from primary provider
                        console.error(`[OcrService] Primary provider (${PRIMARY_OCR_PROVIDER}) failed execution:`, err);
                    }
                }
                else {
                    // If no primary provider is configured, treat it as an error to potentially trigger fallback
                    console.warn(`[OcrService] Primary provider '${PRIMARY_OCR_PROVIDER}' not configured or found.`);
                    primaryError = new Error(`Primary OCR provider '${PRIMARY_OCR_PROVIDER}' not configured.`);
                }
                // Attempt Fallback Provider (only if primary failed OR returned no text)
                if (fallbackProvider && primaryError) {
                    console.log(`[OcrService] Attempting fallback provider: ${FALLBACK_OCR_PROVIDER}`);
                    try {
                        result = yield fallbackProvider.process(fileBuffer, metadata, type);
                        // Check if fallback succeeded *and* returned text
                        if (result && result.text) {
                            console.log(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) succeeded.`);
                            return result; // Return successful fallback result
                        }
                        // If fallback also gives no text, throw the original primary error
                        console.warn(`[OcrService] Fallback provider (${FALLBACK_OCR_PROVIDER}) also returned no text or null result.`);
                        throw primaryError;
                    }
                    catch (fallbackError) {
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
                }
                else {
                    // This case should ideally not be reached if primary ran successfully but without text,
                    // as primaryError would be set. But as a safeguard:
                    throw new Error('OCR processing completed, but no provider returned text.');
                }
            }
            finally {
                // Ensure the original temporary file is deleted after all attempts
                yield this.cleanupTempFile(file.path);
            }
        });
    } // End processFile
    // Private helper to cleanup temp file
    cleanupTempFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!filePath)
                return;
            try {
                yield fs.unlink(filePath);
                console.log(`[OcrService] Deleted temporary file: ${filePath}`);
            }
            catch (unlinkError) {
                // Log error but don't throw, as it shouldn't mask the main processing result/error
                if (unlinkError.code !== 'ENOENT') { // Don't log if file already gone
                    console.error(`[OcrService] Failed to delete temporary file ${filePath}:`, unlinkError);
                }
            }
        });
    }
} // End OcrService
exports.ocrService = new OcrService();
