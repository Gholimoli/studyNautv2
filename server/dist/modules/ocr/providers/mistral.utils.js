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
exports.uploadFile = uploadFile;
exports.getSignedUrl = getSignedUrl;
exports.deleteFile = deleteFile;
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const form_data_1 = __importDefault(require("form-data"));
const logger_1 = require("../../../core/logger/logger"); // Assuming logger is needed here
const app_error_1 = require("../../../core/errors/app.error");
// --- Helper functions for interacting with Mistral /files API ---
const MISTRAL_API_BASE_URL = 'https://api.mistral.ai/v1';
/**
 * Uploads a file to the Mistral API.
 * Should be called within a try/catch block by the caller.
 * @param filePath Path to the local file.
 * @param apiKey Mistral API key.
 * @returns The MistralFile object or null on failure (logged by caller).
 */
function uploadFile(filePath, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!apiKey) {
            throw new app_error_1.AppError('Configuration Error', 'Mistral API key is required for uploadFile.');
        }
        const form = new form_data_1.default();
        const fileContent = yield promises_1.default.readFile(filePath);
        form.append('file', fileContent, path_1.default.basename(filePath));
        form.append('purpose', 'ocr');
        const response = yield axios_1.default.post(`${MISTRAL_API_BASE_URL}/files`, form, {
            headers: Object.assign(Object.assign({}, form.getHeaders()), { Authorization: `Bearer ${apiKey}` }),
            timeout: 60000, // 1 minute timeout for upload
        });
        return response.data;
    });
}
/**
 * Gets a signed URL for a previously uploaded Mistral file.
 * Should be called within a try/catch block by the caller.
 * @param fileId The ID of the uploaded file.
 * @param apiKey Mistral API key.
 * @returns The MistralSignedUrl object or null on failure (logged by caller).
 */
function getSignedUrl(fileId, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!apiKey) {
            throw new app_error_1.AppError('Configuration Error', 'Mistral API key is required for getSignedUrl.');
        }
        const response = yield axios_1.default.get(`${MISTRAL_API_BASE_URL}/files/${fileId}/url`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            timeout: 30000, // 30 second timeout
        });
        return response.data;
    });
}
/**
 * Deletes an uploaded file from Mistral. Handles its own errors internally for logging.
 * @param fileId The ID of the file to delete.
 * @param apiKey Mistral API key.
 */
function deleteFile(fileId, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!apiKey) {
            logger_1.logger.error(`MistralUtils: Cannot delete file ${fileId}, API key missing.`);
            return; // Don't throw, just log and return
        }
        logger_1.logger.info(`MistralUtils: Attempting to delete uploaded file ${fileId}...`);
        try {
            yield axios_1.default.delete(`${MISTRAL_API_BASE_URL}/files/${fileId}`, {
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 30000,
            });
            logger_1.logger.info(`MistralUtils: Successfully deleted file ${fileId}.`);
        }
        catch (error) {
            logger_1.logger.error(`MistralUtils: Failed to delete file ${fileId}`, { error });
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
