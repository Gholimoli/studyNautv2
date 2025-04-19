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
exports.MistralOcrProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const app_error_1 = require("../../../core/errors/app.error");
const logger_1 = require("../../../core/logger/logger");
const config_1 = require("../../../core/config/config");
const MISTRAL_API_BASE_URL = 'https://api.mistral.ai/v1';
class MistralOcrProvider {
    constructor() {
        this.providerName = 'mistral';
        this.maxFileSize = 10 * 1024 * 1024; // 10 MB limit
        this.apiKey = config_1.config.ai.mistralApiKey;
        // Use hardcoded default since mistralOcrModel is not in config type
        this.modelId = 'mistral-ocr-standard';
        if (!this.apiKey) {
            throw new app_error_1.AppError('Configuration Error', 'Mistral API key is missing. Please set MISTRAL_API_KEY environment variable.');
        }
    }
    // Updated process method signature to match IOcrProvider
    process(fileBuffer, metadata, type // Type might be redundant now
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info('MistralOcrProvider: Starting OCR process...', { filename: metadata.originalname, mimetype: metadata.mimetype });
            // Validate buffer size
            if (fileBuffer.byteLength > this.maxFileSize) {
                logger_1.logger.warn(`File buffer exceeds max size (${this.maxFileSize} bytes): ${metadata.originalname}`);
                throw new app_error_1.AppError('File Too Large', `File exceeds the ${this.maxFileSize / (1024 * 1024)}MB size limit.`);
            }
            try {
                // Use direct buffer for PDF, data_uri for images
                if (metadata.mimetype === 'application/pdf') {
                    logger_1.logger.info('Processing PDF buffer via direct API call...');
                    const ocrResponse = yield this.callMistralOcrWithBuffer(fileBuffer, 'application/pdf');
                    return this.formatResult(ocrResponse);
                }
                else if (metadata.mimetype.startsWith('image/')) {
                    logger_1.logger.info('Processing image buffer via data URI...');
                    return yield this.processImageBuffer(fileBuffer, metadata.mimetype);
                }
                else {
                    logger_1.logger.error('MistralOcrProvider: Unsupported mime type provided', { mimetype: metadata.mimetype });
                    throw new app_error_1.AppError('Unsupported Input', `Mistral OCR Provider received an unsupported mime type: ${metadata.mimetype}`);
                }
            }
            catch (error) {
                logger_1.logger.error('Error during Mistral OCR processing, returning null to allow fallback.', {
                    filename: metadata.originalname,
                    error: error instanceof Error ? error.message : String(error)
                });
                // Return null to signal failure and allow OcrService to try the fallback provider.
                return null;
            }
        });
    }
    // Renamed: Central method to call the Mistral OCR endpoint with JSON PAYLOAD
    callMistralOcrWithPayload(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                logger_1.logger.info('Calling Mistral /ocr endpoint with JSON payload...', { model: this.modelId, hasUrl: !!payload.file_url, hasDataUri: !!payload.data_uri });
                const response = yield axios_1.default.post(`${MISTRAL_API_BASE_URL}/ocr`, Object.assign(Object.assign({}, payload), { model: this.modelId }), // Include model ID
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    timeout: 300000, // 5 minutes timeout
                });
                logger_1.logger.info('Mistral OCR call with payload successful.');
                return response.data;
            }
            catch (error) {
                logger_1.logger.error('Mistral OCR API call with payload failed', { error });
                // Keep existing detailed error handling
                if (axios_1.default.isAxiosError(error)) {
                    const axiosError = error; // Add optional detail field
                    const responseData = (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data;
                    const errorMessage = typeof responseData === 'object' && (responseData === null || responseData === void 0 ? void 0 : responseData.message)
                        ? responseData.message
                        : typeof responseData === 'string'
                            ? responseData
                            : axiosError.message;
                    // Log the full response data for more details, especially for 422 errors
                    logger_1.logger.error('Mistral OCR Error Details:', {
                        status: (_b = axiosError.response) === null || _b === void 0 ? void 0 : _b.status,
                        data: JSON.stringify(responseData, null, 2), // Stringify data for better logging
                        message: errorMessage,
                    });
                    throw new app_error_1.AppError('OCR Provider Error', `Mistral API request failed (${((_c = axiosError.response) === null || _c === void 0 ? void 0 : _c.status) || 'Unknown Status'}): ${errorMessage}`);
                }
                else {
                    throw new app_error_1.AppError('OCR Provider Error', `An unexpected error occurred during Mistral OCR call: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        });
    }
    // NEW: Method to call Mistral OCR endpoint with raw file BUFFER
    callMistralOcrWithBuffer(fileBuffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                logger_1.logger.info('Calling Mistral /ocr endpoint with raw buffer...', { model: this.modelId, mimeType: mimeType, size: fileBuffer.length });
                const response = yield axios_1.default.post(`${MISTRAL_API_BASE_URL}/ocr`, fileBuffer, // Send buffer directly as request body
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
                });
                logger_1.logger.info('Mistral OCR call with buffer successful.');
                return response.data;
            }
            catch (error) {
                // Reuse the same detailed error handling as the payload method
                logger_1.logger.error('Mistral OCR API call with buffer failed', { error });
                if (axios_1.default.isAxiosError(error)) {
                    const axiosError = error;
                    const responseData = (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data;
                    const errorMessage = typeof responseData === 'object' && (responseData === null || responseData === void 0 ? void 0 : responseData.message) ? responseData.message : typeof responseData === 'string' ? responseData : axiosError.message;
                    logger_1.logger.error('Mistral OCR Error Details:', { status: (_b = axiosError.response) === null || _b === void 0 ? void 0 : _b.status, data: JSON.stringify(responseData, null, 2), message: errorMessage });
                    throw new app_error_1.AppError('OCR Provider Error', `Mistral API request failed (${((_c = axiosError.response) === null || _c === void 0 ? void 0 : _c.status) || 'Unknown Status'}): ${errorMessage}`);
                }
                else {
                    throw new app_error_1.AppError('OCR Provider Error', `An unexpected error occurred during Mistral OCR call: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        });
    }
    // REMAINS: Method to handle image buffer using data URI
    processImageBuffer(fileBuffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const base64Data = fileBuffer.toString('base64');
                const dataUri = `data:${mimeType};base64,${base64Data}`;
                logger_1.logger.info('Prepared data URI for Mistral image OCR.');
                // Use the payload method for data_uri
                const ocrResponse = yield this.callMistralOcrWithPayload({ data_uri: dataUri });
                return this.formatResult(ocrResponse);
            }
            catch (error) {
                logger_1.logger.error('Error during Mistral image buffer processing', { mimeType, error });
                if (error instanceof app_error_1.AppError) {
                    throw error;
                }
                else {
                    throw new app_error_1.AppError('OCR Processing Error', `An unexpected error occurred during image processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        });
    }
    // Helper to format the Mistral response into the standard OcrResult
    formatResult(mistralResponse) {
        // Basic check if response structure is valid
        if (!mistralResponse || !Array.isArray(mistralResponse.pages)) {
            logger_1.logger.error('Invalid Mistral OCR response structure received', { response: mistralResponse });
            throw new app_error_1.AppError('OCR Provider Error', 'Received invalid response structure from Mistral OCR.');
        }
        const combinedText = mistralResponse.pages
            .map((page) => page.markdown) // Assuming markdown contains the text
            .join('\n\n---\n\n'); // Separate pages clearly
        logger_1.logger.info(`Mistral OCR processing completed. Extracted text from ${mistralResponse.pages.length} pages.`);
        return {
            text: combinedText,
            // Include raw pages if needed for specific use cases or debugging
            // rawResult: mistralResponse, // Optional: include the raw provider response
            provider: this.providerName, // Use the class property
        };
    }
}
exports.MistralOcrProvider = MistralOcrProvider;
