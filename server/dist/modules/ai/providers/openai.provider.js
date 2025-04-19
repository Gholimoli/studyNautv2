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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiProvider = void 0;
const config_1 = require("../../../core/config/config"); // Import validated config
const BASE_URL = 'https://api.openai.com/v1';
// Get default model from validated config
const DEFAULT_MODEL = config_1.config.ai.fallbackProvider || 'gpt-4o-mini'; // Use fallback as default here
class OpenAiProvider {
    constructor(modelName) {
        this.providerName = 'openai';
        this.modelName = modelName || DEFAULT_MODEL;
        this.apiKey = config_1.config.ai.openaiApiKey; // Get key from config
        if (!this.apiKey) {
            console.warn('[OpenAiProvider] OPENAI_API_KEY not found in config. Provider will likely fail.');
        }
    }
    generateText(prompt, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!this.apiKey) { // Check stored key
                return { content: null, errorMessage: 'OpenAI API key not configured.' };
            }
            const apiUrl = `${BASE_URL}/chat/completions`;
            const requestBody = Object.assign(Object.assign(Object.assign({ model: this.modelName, messages: [
                    // Add system prompt if provided
                    ...((options === null || options === void 0 ? void 0 : options.systemPrompt) ? [{ role: 'system', content: options.systemPrompt }] : []),
                    { role: 'user', content: prompt },
                ] }, ((options === null || options === void 0 ? void 0 : options.temperature) && { temperature: options.temperature })), ((options === null || options === void 0 ? void 0 : options.maxOutputTokens) && { max_tokens: options.maxOutputTokens })), ((options === null || options === void 0 ? void 0 : options.jsonMode) && { response_format: { type: 'json_object' } }));
            try {
                console.log(`[OpenAiProvider] Calling model ${this.modelName}...`);
                const response = yield fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`, // Use stored key
                    },
                    body: JSON.stringify(requestBody),
                });
                const responseData = yield response.json();
                if (!response.ok) {
                    console.error('[OpenAiProvider] API Error Response:', responseData);
                    const errorMessage = ((_a = responseData === null || responseData === void 0 ? void 0 : responseData.error) === null || _a === void 0 ? void 0 : _a.message) || `API request failed with status ${response.status}`;
                    return { content: null, errorMessage };
                }
                // Extract content safely
                const generatedText = ((_d = (_c = (_b = responseData === null || responseData === void 0 ? void 0 : responseData.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || null;
                // Extract usage data if available
                const usage = (responseData === null || responseData === void 0 ? void 0 : responseData.usage) ? {
                    promptTokens: responseData.usage.prompt_tokens || 0,
                    completionTokens: responseData.usage.completion_tokens || 0,
                    totalTokens: responseData.usage.total_tokens || 0,
                } : undefined;
                console.log(`[OpenAiProvider] Received response from ${this.modelName}.`);
                return {
                    content: generatedText,
                    usage: usage,
                };
            }
            catch (error) {
                console.error('[OpenAiProvider] Fetch Error:', error);
                const message = error instanceof Error ? error.message : 'Unknown fetch error';
                return { content: null, errorMessage: `Failed to fetch OpenAI API: ${message}` };
            }
        });
    }
}
exports.OpenAiProvider = OpenAiProvider;
