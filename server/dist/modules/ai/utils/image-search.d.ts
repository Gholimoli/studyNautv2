/**
 * Searches for an image using SerpApi Google Images Search.
 * Returns the URL of the first image result, or null if no results or error.
 *
 * @param query The search query (e.g., description from AI).
 * @returns A promise that resolves to the image URL string or null.
 */
export declare function searchImage(query: string): Promise<string | null>;
