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
exports.searchImage = searchImage;
const serpapi_1 = require("serpapi");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '../../../.env' }); // Adjust path relative to dist
const API_KEY = process.env.SERPAPI_API_KEY;
/**
 * Searches for an image using SerpApi Google Images Search.
 * Returns the URL of the first image result, or null if no results or error.
 *
 * @param query The search query (e.g., description from AI).
 * @returns A promise that resolves to the image URL string or null.
 */
function searchImage(query) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!API_KEY) {
            console.error('[ImageSearch] SERPAPI_API_KEY not configured.');
            return null;
        }
        try {
            console.log(`[ImageSearch] Performing image search with query: "${query.substring(0, 80)}..."`);
            const params = {
                engine: "google_images",
                q: query,
                api_key: API_KEY,
                ijn: "0" // Page number (0 for first page)
            };
            // Type definitions for serpapi might be basic, use any if needed
            const response = yield (0, serpapi_1.getJson)(params);
            // Check for image results
            if ((response === null || response === void 0 ? void 0 : response.images_results) && response.images_results.length > 0) {
                const firstImageUrl = (_a = response.images_results[0]) === null || _a === void 0 ? void 0 : _a.original;
                if (firstImageUrl) {
                    console.log(`[ImageSearch] Found image URL: ${firstImageUrl.substring(0, 80)}...`);
                    return firstImageUrl;
                }
            }
            console.warn(`[ImageSearch] No image results found for query: "${query}"`);
            return null;
        }
        catch (error) {
            console.error(`[ImageSearch] Error calling SerpApi:`, error);
            return null;
        }
    });
}
