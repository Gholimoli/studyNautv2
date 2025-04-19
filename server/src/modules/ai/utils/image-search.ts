import { getJson } from 'serpapi';
import axios from 'axios'; // Add axios for Serper POST request
import { config } from '@/core/config/config'; // Import validated config

// Define an interface for the structured image result
export interface ImageSearchResult {
  imageUrl: string;
  altText: string;
  sourceUrl: string;
  sourceTitle: string;
}

// --- Serper API Implementation ---

// Interface for the Serper API image result structure
interface SerperImageResult {
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  source: string;
  domain?: string;
  link: string;
  position?: number;
  imageWidth?: number;
  imageHeight?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

async function searchImagesWithSerper(query: string, count: number = 3): Promise<ImageSearchResult[] | null> {
  const apiKey = config.ai.serperApiKey;
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
    const response = await axios.post<{ images: SerperImageResult[] }>(url, data, { headers });

    if (response.data?.images && response.data.images.length > 0) {
      const results: ImageSearchResult[] = response.data.images
        .map((item: SerperImageResult) => {
          if (item.imageUrl && item.title && item.link && item.source) {
            return {
              imageUrl: item.imageUrl,
              altText: item.title,
              sourceUrl: item.link,      // Use link from Serper
              sourceTitle: item.source // Use source from Serper
            };
          }
          return null;
        })
        .filter((result): result is ImageSearchResult => result !== null);

      console.log(`[ImageSearch:Serper] Found ${results.length} valid image results via Serper.`);
      return results;
    }

    console.warn(`[ImageSearch:Serper] No image results found via Serper for query: "${query}"`);
    return [];

  } catch (error: any) {
    // Log Serper specific errors
    if (axios.isAxiosError(error)) {
      console.error(`[ImageSearch:Serper] Error calling Serper API: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    } else {
      console.error(`[ImageSearch:Serper] Error calling Serper API:`, error);
    }
    return null;
  }
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
export async function searchImages(query: string, count: number = 3): Promise<ImageSearchResult[] | null> {
  const serpapiKey = config.ai.serpapiKey;
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
    const response: any = await getJson(params);

    if (response?.images_results && response.images_results.length > 0) {
      const results: ImageSearchResult[] = response.images_results
        .map((item: any) => {
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
        .filter((result: ImageSearchResult | null): result is ImageSearchResult => result !== null);

      if (results.length > 0) {
          console.log(`[ImageSearch:SerpApi] Found ${results.length} valid image results.`);
          return results; 
      } else {
           console.warn(`[ImageSearch:SerpApi] Found results but none were valid for query: "${query.substring(0, 80)}..."`);
           // Don't fallback here, SerpApi worked but results were unusable
           return [];
      }
    }
    console.warn(`[ImageSearch:SerpApi] No image results found for query: "${query}"`);
    // No results found, proceed to fallback 

  } catch (error: any) {
    console.error(`[ImageSearch:SerpApi] Error calling SerpApi:`, error);
    // Check if the error indicates quota issue before falling back
    const errorMessage = error?.message || JSON.stringify(error || '');
    if (errorMessage.includes('run out of searches') || errorMessage.includes('plan limit')) {
      console.warn('[ImageSearch:SerpApi] Quota likely exceeded. Attempting fallback to Serper...');
      // Proceed to fallback below
    } else {
      // Different error, might not be recoverable, return null for now
      // Or potentially still try fallback?
      console.warn('[ImageSearch:SerpApi] Non-quota error occurred. Attempting fallback to Serper anyway...');
      // return null; 
    }
  }

  // --- Fallback to Serper --- 
  console.log('[ImageSearch] Attempting fallback search using Serper...');
  const serperResults = await searchImagesWithSerper(query, count);

  if (serperResults !== null) {
    return serperResults; // Return Serper results (could be empty array)
  } else {
    // Both failed or Serper not configured
    console.error('[ImageSearch] Both SerpApi and Serper failed or Serper is not configured.');
    return []; // Return empty array to indicate search attempt but no success
  }
}

// Keep the old function signature for compatibility if needed, or remove it.
// For now, let's deprecate it by pointing to the new one.
/**
 * @deprecated Use searchImages instead to get multiple results with more details.
 */
export async function searchImage(query: string): Promise<string | null> {
    const results = await searchImages(query, 1);
    return results?.[0]?.imageUrl ?? null;
} 