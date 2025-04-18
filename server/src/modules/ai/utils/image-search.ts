import { getJson } from 'serpapi';
import { config } from '@/core/config/config'; // Import validated config

/**
 * Searches for an image using SerpApi Google Images Search.
 * Returns the URL of the first image result, or null if no results or error.
 * 
 * @param query The search query (e.g., description from AI).
 * @returns A promise that resolves to the image URL string or null.
 */
export async function searchImage(query: string): Promise<string | null> {
  const apiKey = config.ai.serpapiKey; // Get key from config
  if (!apiKey) { 
    console.error('[ImageSearch] SERPAPI_API_KEY not configured in config.');
    return null;
  }

  try {
    console.log(`[ImageSearch] Performing image search with query: "${query.substring(0, 80)}..."`);
    const params = {
      engine: "google_images",
      q: query,
      api_key: apiKey, // Use key from config
      ijn: "0" // Page number (0 for first page)
    };

    // Type definitions for serpapi might be basic, use any if needed
    const response: any = await getJson(params);

    // Check for image results
    if (response?.images_results && response.images_results.length > 0) {
      const firstImageUrl = response.images_results[0]?.original;
      if (firstImageUrl) {
        console.log(`[ImageSearch] Found image URL: ${firstImageUrl.substring(0, 80)}...`);
        return firstImageUrl;
      }
    }

    console.warn(`[ImageSearch] No image results found for query: "${query}"`);
    return null;

  } catch (error) {
    console.error(`[ImageSearch] Error calling SerpApi:`, error);
    return null;
  }
} 