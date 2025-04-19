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
exports.searchImages = searchImages;
exports.searchImage = searchImage;
const serpapi_1 = require("serpapi");
const axios_1 = __importDefault(require("axios")); // Add axios for Serper POST request
const config_1 = require("../../../core/config/config"); // Import validated config
function searchImagesWithSerper(query_1) {
    return __awaiter(this, arguments, void 0, function* (query, count = 3) {
        var _a, _b, _c;
        const apiKey = config_1.config.ai.serperApiKey;
        if (!apiKey) {
            console.warn('[ImageSearch:Serper] SERPER_API_KEY not configured. Cannot use as fallback.');
            return null;
        }
        const url = 'https://google.serper.dev/images';
        const headers = {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        };
        const data = {
            q: query,
            num: count
            // Add gl, hl etc. if needed later
        };
        try {
            console.log(`[ImageSearch:Serper] Performing image search via Serper for query: "${query.substring(0, 80)}..."`);
            const response = yield axios_1.default.post(url, data, { headers });
            if (((_a = response.data) === null || _a === void 0 ? void 0 : _a.images) && response.data.images.length > 0) {
                const results = response.data.images
                    .map((item) => {
                    if (item.imageUrl && item.title && item.link && item.source) {
                        return {
                            imageUrl: item.imageUrl,
                            altText: item.title,
                            sourceUrl: item.link, // Use link from Serper
                            sourceTitle: item.source // Use source from Serper
                        };
                    }
                    return null;
                })
                    .filter((result) => result !== null);
                console.log(`[ImageSearch:Serper] Found ${results.length} valid image results via Serper.`);
                return results;
            }
            console.warn(`[ImageSearch:Serper] No image results found via Serper for query: "${query}"`);
            return [];
        }
        catch (error) {
            // Log Serper specific errors
            if (axios_1.default.isAxiosError(error)) {
                console.error(`[ImageSearch:Serper] Error calling Serper API: ${(_b = error.response) === null || _b === void 0 ? void 0 : _b.status} - ${JSON.stringify((_c = error.response) === null || _c === void 0 ? void 0 : _c.data)}`);
            }
            else {
                console.error(`[ImageSearch:Serper] Error calling Serper API:`, error);
            }
            return null;
        }
    });
}
// --- Main Search Function with Fallback ---
/**
 * Searches for multiple images using SerpApi (primary) and Serper (fallback).
 * Returns an array of structured image results, or null if a configuration error occurs.
 * Returns an empty array if no results are found after trying both providers.
 *
 * @param query The search query (e.g., description from AI).
 * @param count The maximum number of image results to return (default: 3).
 * @returns A promise that resolves to an array of ImageSearchResult objects, or null on config error.
 */
function searchImages(query_1) {
    return __awaiter(this, arguments, void 0, function* (query, count = 3) {
        const serpapiKey = config_1.config.ai.serpapiKey;
        if (!serpapiKey) {
            console.error('[ImageSearch] SERPAPI_API_KEY not configured in config.');
            // Optionally, try Serper directly if SerpApi isn't configured
            // return searchImagesWithSerper(query, count); 
            return null; // Or return null if primary must be configured
        }
        // --- Try SerpAPI First ---
        try {
            console.log(`[ImageSearch:SerpApi] Performing image search for top ${count} results with query: "${query.substring(0, 80)}..."`);
            const params = {
                engine: "google_images",
                q: query,
                api_key: serpapiKey,
                ijn: "0",
                num: count.toString()
            };
            const response = yield (0, serpapi_1.getJson)(params);
            if ((response === null || response === void 0 ? void 0 : response.images_results) && response.images_results.length > 0) {
                const results = response.images_results
                    .map((item) => {
                    if (item.original && item.title && item.link && item.source) {
                        return {
                            imageUrl: item.original,
                            altText: item.title,
                            sourceUrl: item.link,
                            sourceTitle: item.source
                        };
                    }
                    return null;
                })
                    .filter((result) => result !== null);
                if (results.length > 0) {
                    console.log(`[ImageSearch:SerpApi] Found ${results.length} valid image results.`);
                    return results;
                }
                else {
                    console.warn(`[ImageSearch:SerpApi] Found results but none were valid for query: "${query.substring(0, 80)}..."`);
                    // Don't fallback here, SerpApi worked but results were unusable
                    return [];
                }
            }
            console.warn(`[ImageSearch:SerpApi] No image results found for query: "${query}"`);
            // No results found, proceed to fallback 
        }
        catch (error) {
            console.error(`[ImageSearch:SerpApi] Error calling SerpApi:`, error);
            // Check if the error indicates quota issue before falling back
            const errorMessage = (error === null || error === void 0 ? void 0 : error.message) || JSON.stringify(error || '');
            if (errorMessage.includes('run out of searches') || errorMessage.includes('plan limit')) {
                console.warn('[ImageSearch:SerpApi] Quota likely exceeded. Attempting fallback to Serper...');
                // Proceed to fallback below
            }
            else {
                // Different error, might not be recoverable, return null for now
                // Or potentially still try fallback?
                console.warn('[ImageSearch:SerpApi] Non-quota error occurred. Attempting fallback to Serper anyway...');
                // return null; 
            }
        }
        // --- Fallback to Serper --- 
        console.log('[ImageSearch] Attempting fallback search using Serper...');
        const serperResults = yield searchImagesWithSerper(query, count);
        if (serperResults !== null) {
            return serperResults; // Return Serper results (could be empty array)
        }
        else {
            // Both failed or Serper not configured
            console.error('[ImageSearch] Both SerpApi and Serper failed or Serper is not configured.');
            return []; // Return empty array to indicate search attempt but no success
        }
    });
}
// Keep the old function signature for compatibility if needed, or remove it.
// For now, let's deprecate it by pointing to the new one.
/**
 * @deprecated Use searchImages instead to get multiple results with more details.
 */
function searchImage(query) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const results = yield searchImages(query, 1);
        return (_b = (_a = results === null || results === void 0 ? void 0 : results[0]) === null || _a === void 0 ? void 0 : _a.imageUrl) !== null && _b !== void 0 ? _b : null;
    });
}
