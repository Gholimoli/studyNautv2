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
const ai_types_1 = require("./types/ai.types");
const gemini_provider_1 = require("./providers/gemini.provider");
const openai_provider_1 = require("./providers/openai.provider");
const dotenv = __importStar(require("dotenv"));
const prompts_1 = require("./prompts/prompts");
dotenv.config({ path: '../../.env' }); // Adjust path relative to dist/
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
            let response = yield this.primaryProvider.generateText(prompt, options);
            if (response.content === null && this.fallbackProvider) {
                console.warn(`[AiService] Primary provider failed (${response.errorMessage}). Trying fallback: ${this.fallbackProvider.providerName}`);
                response = yield this.fallbackProvider.generateText(prompt, options);
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
    generateLessonStructure(sourceText) {
        return __awaiter(this, void 0, void 0, function* () {
            // Format the prompt with the source text
            const prompt = prompts_1.GENERATE_LESSON_STRUCTURE.replace('{SOURCE_TEXT}', sourceText);
            const options = {
                jsonMode: true,
                temperature: 0.5,
                // Consider adding maxOutputTokens based on expected structure size
            };
            const response = yield this.generateTextWithFallback(prompt, options);
            if (!response.content) {
                console.error('[AiService] Failed to generate lesson structure. No content received.', { error: response.errorMessage });
                return null;
            }
            try {
                const parsedJson = JSON.parse(response.content);
                const validatedData = ai_types_1.aiStructuredContentSchema.safeParse(parsedJson);
                if (!validatedData.success) {
                    console.error('[AiService] Failed to validate AI response schema:', validatedData.error.errors);
                    console.error('[AiService] Invalid JSON content received:', response.content.substring(0, 500));
                    return null;
                }
                console.log(`[AiService] Successfully generated and validated lesson structure: ${validatedData.data.title}`);
                return validatedData.data;
            }
            catch (error) {
                console.error('[AiService] Failed to parse AI response as JSON:', error);
                console.error('[AiService] Raw AI content:', response.content.substring(0, 500));
                return null;
            }
        });
    }
}
exports.aiService = new AiService();
