/**
 * Placeholder structure for storing prompts.
 * Can be expanded later to load from files, add versioning, etc.
 */

/* eslint-disable max‑lines */

//
// ──────────────────────────────────────────────────────────────────────────
//  Base instructions
// ──────────────────────────────────────────────────────────────────────────
//

const lessonStructureBaseInstructions = `
You are an expert **educator and researcher**. Your goal is to transform raw text into a comprehensive, engaging, and visually‑supported learning resource.
Analyze the following text, **briefly research its core concepts to provide additional depth**, and generate a structured lesson plan in a valid JSON format.
**IMPORTANT:** Generate the entire response (title, summary, structure content, visual descriptions, search queries, added insights, etc.) in the language specified by the language code: **{LANGUAGE_CODE}**.
(Note: {LANGUAGE_CODE} should be the 3‑letter ISO 639‑3 code, e.g., 'eng', 'spa', 'fra')
`;

const lessonStructureJsonFormat = `
The JSON object must strictly adhere to the following structure:
{
  "title": "string", // Overall title for the entire content
  "summary": "string | null", // Overall summary of the entire content (1-3 sentences)
  "structure": [ // Array representing the main sections of the lesson
    {
      "contentType": "heading", // Must be heading for top-level sections
      "level": 1, // Typically 1 for main sections
      "content": "string", // The heading text (plain text only)
      "sectionSummary": "string | null", // Brief summary of THIS section
      "keyPoints": ["string"] | null, // Optional key points for THIS section
      "subStructure": [ // Optional nested array for content WITHIN this section
        {
          "contentType": "string", // e.g., 'heading', 'paragraph', 'list', 'visual_placeholder', 'code_block', 'note_box', 'highlight_box', 'definition', 'example', 'qa'
          "level": "number | null", // Heading level (e.g., 2, 3) if contentType is 'heading', null otherwise
          "content": "string", // Block content (ALWAYS PLAIN TEXT, NO MARKDOWN/HTML)
          "items": ["string"] | null, // Array of strings ONLY for 'list' contentType
          "keyPoints": ["string"] | null, // Array of strings ONLY for 'key_takeaway_box' contentType
          "placeholderId": "string | null", // Unique ID ONLY for 'visual_placeholder'
          "title": "string | null", // Optional title ONLY for callouts like 'note_box', 'highlight_box', 'code_block', 'example'
          "language": "string | null" // Optional language name ONLY for 'code_block'
          // Can potentially nest further with subStructure if needed for complex outlines
        }
        // ... more blocks within this section
      ]
    }
    // ... more main sections
  ],
  "visualOpportunities": [ // List of ALL visuals suggested anywhere in the structure
    {
      "placeholderId": "string", // Matches a placeholderId in the structure
      "concept": "string", // Concept the visual illustrates
      "description": "string", // Detailed description of the ideal visual
      "searchQuery": "string" // Specific image search query
    }
  ]
}
`;

const lessonStructureGuidelines = `
\nGuidelines:\n- **Title & Summary:** Provide a concise, relevant title and a brief 1‑3 sentence summary of the text's main points in the specified {LANGUAGE_CODE}. Use null for summary if not applicable.\n\n- **Enhance Depth & Elaboration:** \n    - **CRITICAL:** Your primary goal is to create a comprehensive educational resource, not just summarize the input. \n    - **Analyze the provided text thoroughly.** Identify the core concepts, arguments, and examples.\n    - **Act like a subject matter expert:** Where the text is brief or assumes prior knowledge, **elaborate** on key concepts. Provide clear definitions, add relevant context, offer illustrative examples, or break down complex ideas into simpler steps. \n    - **Supplement (Briefly):** If necessary, perform a *very brief* internal knowledge check or simulated search to fill minor gaps or provide crucial context missing from the source text. Prioritize explaining concepts mentioned *within* the text first.\n    - **Integration:** Weave these elaborations naturally into the structure using appropriate contentTypes (e.g., 'definition', 'explanation', 'example', 'paragraph'). Avoid just appending researched facts; integrate them contextually.\n    - **Attribution:** While natural integration is preferred, if adding significant external context, you *can* use phrases like "For context," or "To elaborate," but don't overdo it.\n\n- **Structure Array (structure):** This array represents the logical flow of the lesson, broken into main sections.\n    - **Main Sections:** Each object in the top-level \`structure\` array MUST have \`contentType: 'heading'\` and \`level: 1\`.\n    - **Section Summary:** For each main section, provide a brief \`sectionSummary\` (1-2 sentences).\n    - **Section Key Points:** Optionally provide \`keyPoints\` summarizing the main section.\n    - **Sub-Structure (\`subStructure\`):** This REQUIRED nested array contains the actual content blocks for the section.\n        - **Content Blocks:** Each object in \`subStructure\` represents a piece of content (paragraph, list, callout, visual, etc.).\n        - **contentType:** Use the specific types defined in the JSON format section (e.g., 'paragraph', 'list', 'note_box', 'visual_placeholder').\n        - **CRITICAL: \`content\` field MUST be plain text ONLY.** Absolutely NO Markdown (like **, *, #) or HTML tags. All formatting comes from \`contentType\`.\n        - **Visual Placement:** Place \`visual_placeholder\` blocks within the \`subStructure\` where the visual makes the most sense. The corresponding entry in the top-level \`visualOpportunities\` array defines the visual's details.\n        - **Other Fields:** Use \`level\`, \`items\`, \`keyPoints\` (for key_takeaway_box), \`placeholderId\`, \`title\`, \`language\` as appropriate for the \`contentType\`.\n\n- **Visual Opportunities (visualOpportunities):** Identify 3‑5 opportunities where a visual would significantly enhance understanding. Use null if none.\n    - **placeholderId:** Unique ID (e.g., "VISUAL_1") matching *exactly* one 'visual_placeholder' block in the structure.\n    - **concept:** The specific concept the visual illustrates (e.g., "LLM Parameter File Structure").\n    - **description:** Detailed description of the ideal visual needed (e.g., "A simple block diagram showing two distinct boxes. One large box labeled 'Parameters File (e.g., 140GB)' and a smaller box labeled 'Run Code (e.g., 500 lines C)'").\n    - **searchQuery:** A highly effective, specific query for image search (e.g., "LLM parameter file and run code diagram", "open weight vs closed source llm comparison chart").\n\n- **CRITICAL - Placeholder Consistency:** For **every** entry in visualOpportunities, there MUST be exactly one corresponding block in structure with the same placeholderId and contentType: 'visual_placeholder'. Do NOT merge placeholders into other block types.\n
- **Content Variety & Callouts:** Structure the content logically. Use a variety of contentType values to make the lesson engaging and clear (e.g., 'paragraph', 'list', 'definition', 'example'). Use callout boxes (\`note_box\`, \`highlight_box\`) appropriately for emphasis. Generate a \`qa\` block if the content naturally poses and answers questions. Create a \`key_takeaway_box\` (using its \`keyPoints\` field) only for summarizing the absolute most critical points of a subsection, distinct from the main section's \`keyPoints\`.\n
- **Output Format:** Ensure the ENTIRE output is a single, valid JSON object starting with { and ending with }.\n\n- **Field Values:** Use \`null\` for optional fields when not applicable to the specific contentType.\n`;

const lessonStructureInputSection = `
Text to analyze:
---
{SOURCE_TEXT}
---
`;

const lessonStructureClosing = `
Valid JSON Output (in {LANGUAGE_CODE}):
`;

export const GENERATE_LESSON_STRUCTURE = 
  lessonStructureBaseInstructions +
  lessonStructureJsonFormat +
  lessonStructureGuidelines +
  lessonStructureInputSection +
  lessonStructureClosing;

// ──────────────────────────────────────────────────────────────────────────
//  Stubs for future prompts
// ──────────────────────────────────────────────────────────────────────────

export const GENERATE_QUIZ = (_content: string): string => '...';
export const EXTRACT_FLASHCARDS = (_content: string): string => '...';

// ──────────────────────────────────────────────────────────────────────────
//  Subject‑tag generation prompt
// ──────────────────────────────────────────────────────────────────────────

/**
 * Prompt to generate relevant subject tags from content.
 * Expects a JSON response: { "tags": ["tag1", "tag2", ...] }
 */
const generateTagsBase = `
Analyze the following content and identify 3‑5 concise, relevant subject tags or keywords that accurately represent the main topics.
Focus on specific concepts, disciplines, or key entities mentioned.
Avoid overly generic terms unless they are central to the theme.
**IMPORTANT:** Generate the tags themselves in the language specified by the language code: **{LANGUAGE_CODE}**.
(Note: {LANGUAGE_CODE} should be the 3‑letter ISO 639‑3 code, e.g., 'eng', 'spa', 'fra')

Return the tags as a JSON object with a single key "tags" containing an array of strings.

Example Response (for language code 'en'):
{ "tags": ["Quantum Physics", "Superposition", "Entanglement"] }

Content to analyze:
---
`;

const generateTagsClosing = `
---

JSON Response (tags in {LANGUAGE_CODE}):
`;

export const GENERATE_TAGS = (_content: string): string => {
  // basic sanitisation → avoid breaking the prompt with back‑ticks
  const safeContent = _content.replace(/`/g, "'");
    return generateTagsBase + safeContent + generateTagsClosing;
}; 
