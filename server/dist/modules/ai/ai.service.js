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
exports.aiService = void 0;
const ai_types_1 = require("../../modules/ai/types/ai.types");
const gemini_provider_1 = require("./providers/gemini.provider");
const openai_provider_1 = require("./providers/openai.provider");
const dotenv = __importStar(require("dotenv"));
const prompts_1 = require("./prompts/prompts");
const z = __importStar(require("zod"));
dotenv.config({ path: '../../.env' }); // Adjust path relative to dist/
// Define Zod schema for tag response validation
const aiTagResponseSchema = z.object({
    tags: z.array(z.string()).min(1).max(10), // Expect 1-10 string tags
});
const PRIMARY_PROVIDER_NAME = (process.env.PRIMARY_AI_PROVIDER || 'gemini');
const FALLBACK_PROVIDER_NAME = (process.env.FALLBACK_AI_PROVIDER || 'openai');
class AiService {
    constructor() {
        var _a;
        this.primaryProvider = this.createProvider(PRIMARY_PROVIDER_NAME);
        if (FALLBACK_PROVIDER_NAME && FALLBACK_PROVIDER_NAME !== PRIMARY_PROVIDER_NAME) {
            this.fallbackProvider = this.createProvider(FALLBACK_PROVIDER_NAME);
        }
        console.log(`[AiService] Initialized. Primary: ${this.primaryProvider.providerName}, Fallback: ${((_a = this.fallbackProvider) === null || _a === void 0 ? void 0 : _a.providerName) || 'None'}`);
    }
    createProvider(providerName) {
        switch (providerName.toLowerCase()) {
            case 'gemini':
            case 'gemini-1.5-flash':
            case 'gemini-2.0-flash': // Allow specific model names used in config
            case 'gemini-2.5-pro-exp-03-25': // Recognize the new Pro model
                return new gemini_provider_1.GeminiProvider(providerName);
            case 'openai':
            case 'gpt-4o':
            case 'gpt-4o-mini': // Allow specific model names used in config
                return new openai_provider_1.OpenAiProvider(providerName);
            // Add cases for other providers later
            default:
                console.warn(`[AiService] Unsupported AI provider specified: ${providerName}. Defaulting to Gemini.`);
                return new gemini_provider_1.GeminiProvider(); // Default fallback
        }
    }
    /**
     * Generates text content using the primary provider, with fallback if configured.
     */
    generateTextWithFallback(prompt, options) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[AiService] Generating text using primary provider: ${this.primaryProvider.providerName}`);
            let response;
            try {
                response = yield this.primaryProvider.generateText(prompt, options);
            }
            catch (error) {
                console.error(`[AiService] Primary provider ${this.primaryProvider.providerName} threw error:`, error);
                response = { content: null, errorMessage: (error instanceof Error ? error.message : 'Unknown error'), usage: undefined };
            }
            if (response.content === null && this.fallbackProvider) {
                console.warn(`[AiService] Primary provider failed (${response.errorMessage}). Trying fallback: ${this.fallbackProvider.providerName}`);
                try {
                    response = yield this.fallbackProvider.generateText(prompt, options);
                }
                catch (fallbackError) {
                    console.error(`[AiService] Fallback provider ${this.fallbackProvider.providerName} threw error:`, fallbackError);
                    response = { content: null, errorMessage: (fallbackError instanceof Error ? fallbackError.message : 'Unknown error'), usage: undefined };
                }
                if (response.content === null) {
                    console.error(`[AiService] Fallback provider also failed (${response.errorMessage}).`);
                }
            }
            return response;
        });
    }
    /**
     * Generates structured lesson content from source text.
     * Ensures the output conforms to the AiStructuredContent schema.
     */
    generateLessonStructure(sourceText_1) {
        return __awaiter(this, arguments, void 0, function* (sourceText, languageCode = 'eng') {
            const promptTemplate = prompts_1.GENERATE_LESSON_STRUCTURE;
            const prompt = promptTemplate
                .replace('{SOURCE_TEXT}', sourceText)
                .replace(/{LANGUAGE_CODE}/g, languageCode); // Use global replace
            const options = {
                jsonMode: true,
                temperature: 0.5,
                maxOutputTokens: 8192,
            };
            const response = yield this.generateTextWithFallback(prompt, options);
            if (!response.content) {
                console.error('[AiService] Failed to generate lesson structure. No content received.', { error: response.errorMessage });
                return null;
            }
            try {
                // --- Clean potential markdown fences --- 
                let contentToParse = response.content.trim();
                const jsonFenceStart = '```json';
                const jsonFenceEnd = '```';
                if (contentToParse.startsWith(jsonFenceStart) && contentToParse.endsWith(jsonFenceEnd)) {
                    console.log('[AiService] Removing JSON markdown fences for lesson structure...');
                    contentToParse = contentToParse.substring(jsonFenceStart.length, contentToParse.length - jsonFenceEnd.length).trim();
                }
                else if (contentToParse.startsWith('```') && contentToParse.endsWith('```')) {
                    // Handle generic fences just in case
                    console.log('[AiService] Removing generic markdown fences for lesson structure...');
                    contentToParse = contentToParse.substring(3, contentToParse.length - 3).trim();
                }
                // --- End cleaning ---
                if (!contentToParse) {
                    console.error('[AiService] Content is empty after stripping fences for lesson structure.');
                    return null;
                }
                const parsedJson = JSON.parse(contentToParse);
                const validatedData = ai_types_1.aiStructuredContentSchema.safeParse(parsedJson);
                if (!validatedData.success) {
                    console.error('[AiService] Failed to validate lesson structure schema:', validatedData.error.errors);
                    console.error('[AiService] Invalid JSON content received:', response.content.substring(0, 500));
                    return null;
                }
                console.log(`[AiService] Successfully generated and validated lesson structure: ${validatedData.data.title}`);
                return validatedData.data;
            }
            catch (error) {
                console.error('[AiService] Failed to parse lesson structure as JSON:', error);
                console.error('[AiService] Raw AI content:', response.content.substring(0, 500));
                return null;
            }
        });
    }
    /**
     * Generates relevant subject tags for the given text content.
     * Returns an array of tag strings.
     */
    generateTags(textContent_1) {
        return __awaiter(this, arguments, void 0, function* (textContent, languageCode = 'eng') {
            const MAX_TAG_INPUT_LENGTH = 5000;
            const truncatedText = textContent.substring(0, MAX_TAG_INPUT_LENGTH);
            const promptTemplate = (0, prompts_1.GENERATE_TAGS)(truncatedText); // GENERATE_TAGS returns a function, invoke it
            const prompt = promptTemplate.replace(/{LANGUAGE_CODE}/g, languageCode); // Use global replace
            const options = {
                jsonMode: true,
                temperature: 0.3,
                maxOutputTokens: 100
            };
            console.log('[AiService] Generating tags...');
            const response = yield this.generateTextWithFallback(prompt, options);
            if (!response.content) {
                console.error('[AiService] Failed to generate tags. No content received.', { error: response.errorMessage });
                return [];
            }
            try {
                // --- Clean potential markdown fences --- 
                let contentToParse = response.content.trim();
                const jsonFenceStart = '```json';
                const jsonFenceEnd = '```';
                if (contentToParse.startsWith(jsonFenceStart) && contentToParse.endsWith(jsonFenceEnd)) {
                    console.log('[AiService] Removing JSON markdown fences for tags...');
                    contentToParse = contentToParse.substring(jsonFenceStart.length, contentToParse.length - jsonFenceEnd.length).trim();
                }
                else if (contentToParse.startsWith('```') && contentToParse.endsWith('```')) {
                    // Handle generic fences just in case
                    console.log('[AiService] Removing generic markdown fences for tags...');
                    contentToParse = contentToParse.substring(3, contentToParse.length - 3).trim();
                }
                // --- End cleaning ---
                if (!contentToParse) {
                    console.error('[AiService] Content is empty after stripping fences for tags.');
                    return [];
                }
                const parsedJson = JSON.parse(contentToParse);
                const validatedData = aiTagResponseSchema.safeParse(parsedJson);
                if (!validatedData.success) {
                    console.error('[AiService] Failed to validate AI tag response schema:', validatedData.error.errors);
                    console.error('[AiService] Invalid JSON content received for tags:', response.content.substring(0, 500));
                    return [];
                }
                console.log(`[AiService] Successfully generated ${validatedData.data.tags.length} tags.`);
                return validatedData.data.tags;
            }
            catch (error) {
                console.error('[AiService] Failed to parse AI tag response as JSON:', error);
                console.error('[AiService] Raw AI content for tags:', response.content.substring(0, 500));
                return [];
            }
        });
    }
}
exports.aiService = new AiService();
