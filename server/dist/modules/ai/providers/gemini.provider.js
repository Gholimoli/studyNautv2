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
exports.GeminiProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../core/config/config"); // Import validated config
const app_error_1 = require("../../../core/errors/app.error");
const logger_1 = require("../../../core/logger/logger");
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash'; // Use Flash 2 as default
const DEFAULT_VISION_MODEL = 'gemini-pro-vision'; // Or your actual default vision model
class GeminiProvider {
    constructor(modelName, visionModelName) {
        this.providerName = 'gemini';
        // Use the consistent config property for the Gemini API key
        const key = config_1.config.ai.geminiApiKey;
        if (!key) {
            // Log warning but don't throw immediately, allow instantiation
            logger_1.logger.warn('[GeminiProvider] GEMINI_API_KEY not found in config. Provider will likely fail.');
            // Throw error here if API key is strictly required for instantiation
            throw new app_error_1.AppError('Configuration Error', 'Gemini API key is missing. Please set GEMINI_API_KEY environment variable.');
        }
        this.apiKey = key;
        this.modelName = modelName || DEFAULT_MODEL;
        this.visionModelName = visionModelName || DEFAULT_VISION_MODEL;
        logger_1.logger.info(`GeminiProvider initialized with model: ${this.modelName}, vision model: ${this.visionModelName}`);
    }
    generateText(prompt, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            if (!this.apiKey) {
                logger_1.logger.error('[GeminiProvider] Attempted generateText without API key configured.');
                // Return structure indicating configuration error
                return {
                    content: null,
                    errorMessage: 'Gemini API key not configured.'
                };
            }
            const apiUrl = `${BASE_URL}/${this.modelName}:generateContent?key=${this.apiKey}`;
            const requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: Object.assign({}, ((options === null || options === void 0 ? void 0 : options.temperature) && { temperature: options.temperature }))
            };
            try {
                logger_1.logger.info(`Calling Gemini API (${this.modelName}) for text generation...`);
                const response = yield axios_1.default.post(apiUrl, requestBody, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000, // Use default 60s timeout
                });
                const content = ((_f = (_e = (_d = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) || null;
                if (!content) {
                    logger_1.logger.warn('Gemini API response missing expected text content.', { data: response.data });
                }
                return { content: content };
            }
            catch (error) {
                logger_1.logger.error(`Gemini API (${this.modelName}) text generation failed:`, { error });
                const errorMessage = this.parseErrorMessage(error);
                return {
                    content: null,
                    errorMessage: errorMessage
                };
            }
        });
    }
    // Add other methods like generateVisual, handle multimodal if needed
    // Helper to parse error messages (can be reused)
    parseErrorMessage(error) {
        var _a, _b, _c;
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const backendError = (_b = (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error;
            return (`Gemini API Error (${(_c = axiosError.response) === null || _c === void 0 ? void 0 : _c.status}): ${(backendError === null || backendError === void 0 ? void 0 : backendError.message) || axiosError.message}`);
        }
        else if (error instanceof Error) {
            return error.message;
        }
        else {
            return 'Unknown Gemini provider error';
        }
    }
}
exports.GeminiProvider = GeminiProvider;
