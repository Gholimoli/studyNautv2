"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiOcrProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const app_error_1 = require("../../../core/errors/app.error");
const logger_1 = require("../../../core/logger/logger");
const config_1 = require("../../../core/config/config");
// Gemini API configuration
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
class GeminiOcrProvider {
    constructor() {
        this.providerName = 'gemini';
        this.modelName = 'gemini-2.0-flash';
        this.apiKey = config_1.config.ai.geminiApiKey;
        if (!this.apiKey) {
            throw new app_error_1.AppError('Configuration Error', 'Gemini API key is missing. Please set GEMINI_API_KEY environment variable.');
        }
    }
    process(fileBuffer, metadata, type // Type might be used for specific prompting if needed
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            logger_1.logger.info(`GeminiOcrProvider: Starting OCR process for ${metadata.originalname}...`);
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
                logger_1.logger.info(`Calling Gemini API endpoint: ${this.modelName}`);
                const response = yield axios_1.default.post(`${GEMINI_API_ENDPOINT}?key=${this.apiKey}`, requestPayload, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 300000, // 5 minutes timeout
                });
                // --- Response Parsing (Important: Structure may vary) ---
                // Gemini's response structure needs careful handling.
                // Assuming the text is within response.data.candidates[0].content.parts[0].text
                const candidates = (_a = response.data) === null || _a === void 0 ? void 0 : _a.candidates;
                if (!candidates || candidates.length === 0 || !((_b = candidates[0].content) === null || _b === void 0 ? void 0 : _b.parts) || candidates[0].content.parts.length === 0) {
                    logger_1.logger.warn('Gemini OCR response missing expected text structure', { responseData: response.data });
                    throw new app_error_1.AppError('OCR Provider Error', 'Gemini API response did not contain expected content structure.');
                }
                // Concatenate text from all parts, just in case
                const extractedText = candidates[0].content.parts.map((part) => part.text || '').join('\n');
                if (!extractedText.trim()) {
                    logger_1.logger.warn(`Gemini OCR for ${metadata.originalname} resulted in empty text.`);
                    // Consider if empty text is an error or valid result
                }
                logger_1.logger.info(`Gemini OCR processing completed for ${metadata.originalname}.`);
                return {
                    text: extractedText || '',
                    provider: this.providerName,
                };
            }
            catch (error) {
                logger_1.logger.error('Gemini OCR API call failed', { filename: metadata.originalname, error });
                if (axios_1.default.isAxiosError(error)) {
                    const axiosError = error; // Use any for potentially varied error structures
                    const errorMessage = ((_e = (_d = (_c = axiosError.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.message) || axiosError.message;
                    logger_1.logger.error('Gemini OCR Error Details:', {
                        status: (_f = axiosError.response) === null || _f === void 0 ? void 0 : _f.status,
                        data: JSON.stringify((_g = axiosError.response) === null || _g === void 0 ? void 0 : _g.data, null, 2),
                        message: errorMessage,
                    });
                    throw new app_error_1.AppError('OCR Provider Error', `Gemini API request failed (${((_h = axiosError.response) === null || _h === void 0 ? void 0 : _h.status) || 'Unknown Status'}): ${errorMessage}`);
                }
                else {
                    throw new app_error_1.AppError('OCR Provider Error', `An unexpected error occurred during Gemini OCR call: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        });
    }
}
exports.GeminiOcrProvider = GeminiOcrProvider;
