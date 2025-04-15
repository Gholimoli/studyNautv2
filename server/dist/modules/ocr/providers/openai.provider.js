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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIOcrProvider = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_OCR_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
class OpenAIOcrProvider {
    constructor() {
        this.providerName = 'openai';
    }
    process(fileBuffer, metadata, type) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!OPENAI_API_KEY) {
                throw new Error('OPENAI_API_KEY not set');
            }
            console.log(`[OpenAIOcrProvider] Processing buffer for: ${metadata.originalname}`);
            const base64 = fileBuffer.toString('base64');
            const mimeType = type === 'pdf' ? 'application/pdf' : metadata.mimetype;
            const messages = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract all readable text from this document.' },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64}`,
                            },
                        },
                    ],
                },
            ];
            const res = yield (0, node_fetch_1.default)(OPENAI_OCR_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: OPENAI_MODEL,
                    messages,
                    max_tokens: 4096,
                }),
            });
            const resText = yield res.text();
            console.log(`[OpenAIOcrProvider] Response status: ${res.status}`);
            console.log(`[OpenAIOcrProvider] Response text: ${resText.substring(0, 500)}...`);
            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error(`[OpenAIOcrProvider] API error 401: Invalid OpenAI API Key.`);
                }
                if (res.status === 429) {
                    throw new Error(`[OpenAIOcrProvider] API error 429: OpenAI Rate Limit Exceeded.`);
                }
                throw new Error(`[OpenAIOcrProvider] API error: ${res.status} ${resText}`);
            }
            let data;
            try {
                data = JSON.parse(resText);
            }
            catch (parseError) {
                console.error("[OpenAIOcrProvider] Raw response text on parse failure:", resText);
                throw new Error(`[OpenAIOcrProvider] Failed to parse OpenAI JSON response: ${parseError}`);
            }
            const text = ((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '';
            console.log(`[OpenAIOcrProvider] Successfully processed. Extracted ${text.length} characters.`);
            return {
                text,
                provider: this.providerName,
                meta: { usage: data.usage },
            };
        });
    }
}
exports.OpenAIOcrProvider = OpenAIOcrProvider;
