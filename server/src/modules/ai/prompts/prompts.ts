/**
 * Placeholder structure for storing prompts.
 * Can be expanded later to load from files, add versioning, etc.
 */

// NOTE: This prompt needs refinement based on testing and AI provider capabilities.
// It currently includes basic instructions for JSON output based on aiStructuredContentSchema.
export const GENERATE_LESSON_STRUCTURE = `
You are an expert educational content creator. Analyze the following text and generate a structured lesson plan in a valid JSON format.

The JSON object must strictly adhere to the following structure:
{
  "title": "string",
  "summary": "string | null", // Optional: A brief 1-2 sentence summary of the text's main points.
  "structure": [ // An array of lesson blocks
    {
      "type": "heading" | "subheading" | "paragraph" | "bullet_list" | "key_term" | "visual_placeholder",
      "content": "string", // Text content for most types, or a description for visual_placeholder.
      "level": number | null, // Optional: Heading level (1, 2, 3, etc.) only for 'heading' type.
      "items": ["string"] | null, // Optional: An array of strings, only for 'bullet_list' type.
      "placeholderId": "string | null" // Optional: Unique ID (e.g., "VISUAL_1"), only for 'visual_placeholder' type.
    }
    // ... more blocks
  ],
  "visualOpportunities": [ // Optional: Array of identified visual opportunities.
    {
      "placeholderId": "string", // Unique ID matching a visual_placeholder block in the structure.
      "description": "string", // Detailed description of the visual needed to illustrate a concept.
      "searchQuery": "string | null" // Optional: A suggested, optimized query for image search engines.
    }
    // ... more opportunities
  ] | null
}

Guidelines:
- Create a logical flow with clear headings and subheadings.
- Break down long text into concise paragraphs.
- Use bullet lists for key points or steps.
- Identify and extract important keywords or concepts using the 'key_term' type.
- **Crucially**: Identify 3-5 key concepts or sections in the text that would benefit MOST from a visual aid (e.g., diagram, image, chart). For each opportunity:
    1. Add a corresponding block to the "structure" array with type "visual_placeholder". Set its "content" to a brief description of the visual (e.g., "Diagram of the water cycle"). Assign a unique "placeholderId" (e.g., "VISUAL_1", "VISUAL_2").
    2. Add a corresponding object to the "visualOpportunities" array. Include the matching "placeholderId", a detailed "description" of the visual needed, and optionally a good "searchQuery" for finding it.
- Ensure the ENTIRE output is a single, valid JSON object starting with { and ending with }.
- Do NOT include any text or explanations outside the main JSON object.
- Use null for optional fields if they are not applicable or generated.

Text to analyze:
---
{SOURCE_TEXT}
---

Valid JSON Output:
`;

// Add other prompts (e.g., GENERATE_QUIZ, EXTRACT_FLASHCARDS) later.

export const GENERATE_QUIZ = (content: string): string => `...`;
export const EXTRACT_FLASHCARDS = (content: string): string => `...`;

/**
 * Prompt to generate relevant subject tags from content.
 * Expects a JSON response: { "tags": ["tag1", "tag2", ...] }
 */
export const GENERATE_TAGS = (content: string): string => `
Analyze the following content and identify 3-5 concise, relevant subject tags or keywords that accurately represent the main topics.
Focus on specific concepts, disciplines, or key entities mentioned.
Avoid overly generic terms unless they are central to the theme.

Return the tags as a JSON object with a single key "tags" containing an array of strings.

Example Response:
{ "tags": ["Quantum Physics", "Superposition", "Entanglement"] }

Content to analyze:
---
${content}
---

JSON Response:
`; 