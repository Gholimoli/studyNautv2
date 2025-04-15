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
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os")); // Needed for tmpdir
const crypto_1 = __importDefault(require("crypto")); // Needed for unique filename
const form_data_1 = __importDefault(require("form-data"));
const logger_1 = require("@/core/logger/logger");
const app_error_1 = require("@/core/errors/app.error");
const config_1 = require("@/core/config/config");
class MistralOcrProvider {
    constructor() {
        this.providerName = 'mistral';
        this.baseUrl = 'https://api.mistral.ai/v1';
        if (!config_1.config.mistralApiKey) {
            throw new app_error_1.AppError('Configuration Error', 'Mistral API key is not configured.');
        }
        this.apiKey = config_1.config.mistralApiKey;
    }
    process(fileBuffer, metadata, type) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            logger_1.logger.info(`MistralOcrProvider: Processing ${type} file: ${metadata.originalname}`);
            let tempFilePath = null; // For PDF processing
            try {
                if (type === 'pdf') {
                    // For PDFs, save buffer to temp file to use existing upload logic
                    const tempDir = os_1.default.tmpdir();
                    // Create a unique temporary filename
                    const uniqueSuffix = crypto_1.default.randomBytes(6).toString('hex');
                    tempFilePath = path_1.default.join(tempDir, `${uniqueSuffix}-${metadata.originalname}`);
                    yield promises_1.default.writeFile(tempFilePath, fileBuffer);
                    logger_1.logger.info(`MistralOcrProvider: Saved PDF buffer to temp file: ${tempFilePath}`);
                    return yield this.processPdf(tempFilePath); // Pass the path
                }
                else if (type === 'image') {
                    // For images, use the buffer directly for base64
                    return yield this.processImageBase64(fileBuffer, metadata.mimetype); // Pass buffer and mimetype
                }
                else {
                    logger_1.logger.error(`MistralOcrProvider: Unsupported file type: ${type}`);
                    return null;
                }
            }
            catch (error) { // Catch unknown error type
                logger_1.logger.error('MistralOcrProvider: Error processing file', { name: metadata.originalname, error });
                // Type guard for AxiosError
                if (axios_1.default.isAxiosError(error)) {
                    logger_1.logger.error('Mistral API Error Details:', {
                        status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
                        data: (_b = error.response) === null || _b === void 0 ? void 0 : _b.data,
                        message: error.message,
                    });
                }
                else if (error instanceof Error) { // Handle generic Errors
                    logger_1.logger.error('Mistral Processing Error:', { message: error.message, stack: error.stack });
                }
                else {
                    // Handle other potential error types if necessary
                    logger_1.logger.error('Mistral Processing Error: Unknown error type occurred.');
                }
                return null; // Indicate failure for fallback
            }
            finally {
                // Cleanup temp file if it was created for PDF
                if (tempFilePath) {
                    try {
                        yield promises_1.default.unlink(tempFilePath);
                        logger_1.logger.info(`MistralOcrProvider: Deleted temp PDF file: ${tempFilePath}`);
                    }
                    catch (cleanupError) {
                        logger_1.logger.error(`MistralOcrProvider: Failed to delete temp PDF file: ${tempFilePath}`, { cleanupError });
                    }
                }
            }
        });
    }
    // --- PDF Processing Logic (Upload + Signed URL + Cleanup) ---
    processPdf(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const uploadedFile = yield this.uploadFile(filePath);
            if (!uploadedFile)
                return null;
            logger_1.logger.info(`MistralOcrProvider: PDF file uploaded, ID: ${uploadedFile.id}`);
            let signedUrl = null;
            try {
                signedUrl = yield this.getSignedUrl(uploadedFile.id);
            }
            catch (getUrlError) {
                // Error getting URL, ensure cleanup before returning
                yield this.deleteFile(uploadedFile.id);
                return null;
            }
            if (!signedUrl) {
                // No URL obtained, ensure cleanup
                yield this.deleteFile(uploadedFile.id);
                return null;
            }
            logger_1.logger.info(`MistralOcrProvider: Obtained signed URL for PDF.`);
            let ocrData = null;
            try {
                const response = yield axios_1.default.post(`${this.baseUrl}/ocr`, {
                    model: 'mistral-ocr-latest',
                    document: {
                        type: 'document_url', // Correct type for signed URL PDF
                        document_url: signedUrl.url,
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    timeout: 120000, // 2 minute timeout
                });
                ocrData = response.data;
                logger_1.logger.info(`MistralOcrProvider: PDF OCR successful.`);
            }
            catch (ocrError) { // Catch specific OCR error
                logger_1.logger.error('MistralOcrProvider: Error during PDF OCR call', { ocrError });
                if (axios_1.default.isAxiosError(ocrError)) {
                    logger_1.logger.error('Mistral OCR API Error Details:', {
                        status: (_a = ocrError.response) === null || _a === void 0 ? void 0 : _a.status,
                        data: (_b = ocrError.response) === null || _b === void 0 ? void 0 : _b.data,
                        message: ocrError.message,
                    });
                }
                else if (ocrError instanceof Error) {
                    logger_1.logger.error('Mistral OCR Processing Error:', { message: ocrError.message });
                }
                else {
                    logger_1.logger.error('Mistral OCR Processing Error: Unknown error type occurred.');
                }
                // Fall through to cleanup
            }
            finally {
                // Ensure cleanup happens regardless of OCR success/failure
                yield this.deleteFile(uploadedFile.id);
            }
            // Format result only if OCR was successful
            return ocrData ? this.formatResult(ocrData) : null;
        });
    }
    // --- Image Processing Logic (Base64 Encoding) ---
    processImageBase64(fileBuffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            const base64Image = fileBuffer.toString('base64');
            // Ensure it's a valid image MIME type for the data URI
            if (!mimeType.startsWith('image/')) {
                logger_1.logger.error(`MistralOcrProvider: Invalid or unsupported image MIME type provided: ${mimeType}`);
                return null;
            }
            logger_1.logger.info(`MistralOcrProvider: Image buffer encoded to base64 (MIME: ${mimeType}). Calling OCR endpoint.`);
            // No try/catch here, let the main `process` method handle errors
            const response = yield axios_1.default.post(`${this.baseUrl}/ocr`, {
                model: 'mistral-ocr-latest',
                document: {
                    type: 'image_url', // Type for base64 image according to docs
                    image_url: `data:${mimeType};base64,${base64Image}`, // Correct data URI format
                },
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                timeout: 60000, // 1 minute timeout for image
            });
            logger_1.logger.info(`MistralOcrProvider: Image OCR successful.`);
            return this.formatResult(response.data);
            // No file upload/delete needed for base64 approach
        });
    }
    // --- Helper methods for PDF processing ---
    uploadFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new form_data_1.default();
            // Use fs.readFile instead of opening a stream handle manually
            const fileContent = yield promises_1.default.readFile(filePath);
            // Use path.basename for safety, although originalname might be better from metadata if available
            form.append('file', fileContent, path_1.default.basename(filePath));
            form.append('purpose', 'ocr');
            // No try/catch here, let the caller (processPdf -> process) handle errors
            const response = yield axios_1.default.post(`${this.baseUrl}/files`, form, {
                headers: Object.assign(Object.assign({}, form.getHeaders()), { Authorization: `Bearer ${this.apiKey}` }),
                timeout: 60000, // 1 minute timeout for upload
            });
            return response.data;
        });
    }
    // Takes fileId
    getSignedUrl(fileId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Let the caller handle potential errors (processPdf -> process)
            const response = yield axios_1.default.get(`${this.baseUrl}/files/${fileId}/url`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 30000, // 30 second timeout
            });
            return response.data;
        });
    }
    // Helper method to delete uploaded file for cleanup
    // Takes fileId
    deleteFile(fileId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            logger_1.logger.info(`MistralOcrProvider: Attempting to delete uploaded file ${fileId}...`);
            try {
                yield axios_1.default.delete(`${this.baseUrl}/files/${fileId}`, {
                    headers: { Authorization: `Bearer ${this.apiKey}` },
                    timeout: 30000,
                });
                logger_1.logger.info(`MistralOcrProvider: Successfully deleted file ${fileId}.`);
            }
            catch (error) {
                logger_1.logger.error(`MistralOcrProvider: Failed to delete file ${fileId}`, { error });
                // Log details but don't throw, cleanup failure shouldn't prevent returning results if OCR succeeded before cleanup
                if (axios_1.default.isAxiosError(error)) {
                    logger_1.logger.error('Mistral Delete Error Details:', {
                        status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
                        data: (_b = error.response) === null || _b === void 0 ? void 0 : _b.data,
                        message: error.message,
                    });
                }
                else if (error instanceof Error) {
                    logger_1.logger.error('Mistral Delete Processing Error:', { message: error.message });
                }
            }
        });
    }
    // --- End Helper methods ---
    formatResult(data) {
        if (!data || !data.pages || data.pages.length === 0) {
            logger_1.logger.warn('MistralOcrProvider: Received null or empty pages in OCR response.');
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
exports.MistralOcrProvider = MistralOcrProvider;
