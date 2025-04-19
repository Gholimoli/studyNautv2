"use strict";
/**
 * Placeholder structure for storing prompts.
 * Can be expanded later to load from files, add versioning, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATE_TAGS = exports.EXTRACT_FLASHCARDS = exports.GENERATE_QUIZ = exports.GENERATE_LESSON_STRUCTURE = void 0;
// NOTE: This prompt needs refinement based on testing and AI provider capabilities.
// It currently includes basic instructions for JSON output based on aiStructuredContentSchema.
const lessonStructureBaseInstructions = `
You are an expert **educator and researcher**. Your goal is to transform raw text into a comprehensive, engaging, and visually-supported learning resource.
Analyze the following text, **briefly research its core concepts to provide additional depth**, and generate a structured lesson plan in a valid JSON format.
**IMPORTANT:** Generate the entire response (title, summary, structure content, visual descriptions, search queries, added insights, etc.) in the language specified by the language code: **{LANGUAGE_CODE}**.
(Note: {LANGUAGE_CODE} should be the 3-letter ISO 639-3 code, e.g., 'eng', 'spa', 'fra')
`;
const lessonStructureJsonFormat = `
The JSON object must strictly adhere to the following structure:
{
  "title": "string",
  "summary": "string",
  "structure": [
    {
      "contentType": "string",
      "content": "string",
      "level": "number",
      "items": ["string"],
      "keyPoints": ["string"],
      "placeholderId": "string"
    }
  ],
  "visualOpportunities": [
    {
      "placeholderId": "string",
      "concept": "string",
      "description": "string",
      "searchQuery": "string"
    }
  ]
}
`;
const lessonStructureGuidelines = `
Guidelines:
- Provide a concise, relevant title for the lesson based on the text.
- Provide a brief 1-3 sentence summary of the text's main points. Use null if not applicable.
- **Enhance Depth:** Based on the core topic, incorporate 1-2 additional relevant insights, brief explanations, or illustrative examples that go slightly beyond the provided text. Integrate these naturally within the generated structure (e.g., in paragraphs, explanations, or examples) to add value and context. Keep these additions concise and directly related to the topic. **Where appropriate, you can subtly indicate externally added context (e.g., starting a sentence with "For further context," or similar) but prioritize natural flow.**
- The "structure" array represents the content flow.
- "contentType" is the semantic type of the content block (e.g., "heading", "paragraph", "bullet_list", "code_block", "advanced_code_block", "definition", "key_takeaway_box", "callout_info", "visual_placeholder", "introduction", "explanation", "example"). 
    - Use 'advanced_code_block' for code snippets longer than one line or requiring specific formatting/language context. 
    - **Use 'callout_info' for important tips, warnings, interesting facts, or supplementary information that should stand out from the main text flow.**
    - **Use 'key_takeaway_box' (with the 'keyPoints' field) primarily at the end of significant sections or topics to summarize the most critical conclusions or points for the learner.**
- "content" is the text content for the block. For 'visual_placeholder', a brief description (e.g., 'Diagram showing structure'). For 'advanced_code_block', include the full code snippet here.
- "level" is the heading level (1, 2, 3, etc.) ONLY for 'heading' contentType. Use null if not applicable.
- "items" is an array of strings, ONLY for 'bullet_list' contentType. Use null if not applicable.
- "keyPoints" is an array of 1-3 crucial bullet points summarizing the core message of this block/section, ideal for 'key_takeaway_box'. Use null if not applicable.
- "placeholderId" is a unique ID (e.g., "VISUAL_1"), ONLY for 'visual_placeholder' contentType. Use null if not applicable.
- The "visualOpportunities" array should contain 3-5 identified visual opportunities. Use null if none.
- For each visual opportunity, include:
    - "placeholderId": Unique ID matching a visual_placeholder block in the structure.
    - "concept": The specific concept the visual should illustrate.
    - "description": Detailed description of the visual needed (e.g., 'Flowchart illustrating the process of photosynthesis').
    - "searchQuery": A high-quality, optimized query for image search engines (e.g., Google Images, SerpApi).
- **CRITICAL:** For every entry you create in the "visualOpportunities" array with a specific "placeholderId", you MUST create a corresponding block within the "structure" array that uses the exact same "placeholderId" value AND has its "contentType" set explicitly to "visual_placeholder". Do not merge this placeholder into a paragraph block.
- Create a logical flow using appropriate 'contentType' values.
- Use 'key_takeaway_box' with 'keyPoints' to highlight critical summaries **where logically appropriate (don't overuse)**.
- Ensure the ENTIRE output is a single, valid JSON object starting with { and ending with }.
- Do NOT include any text, explanations, or markdown formatting outside the main JSON object itself.
- Use null for optional fields if they are not applicable or generated.
`;
const lessonStructureInputSection = `
Text to analyze:
---
{SOURCE_TEXT}
---
`;
const lessonStructureClosing = `
Valid JSON Output (in {LANGUAGE_CODE}):
`;
exports.GENERATE_LESSON_STRUCTURE = lessonStructureBaseInstructions +
    lessonStructureJsonFormat +
    lessonStructureGuidelines +
    lessonStructureInputSection +
    lessonStructureClosing;
// Add other prompts (e.g., GENERATE_QUIZ, EXTRACT_FLASHCARDS) later.
const GENERATE_QUIZ = (content) => `...`;
exports.GENERATE_QUIZ = GENERATE_QUIZ;
const EXTRACT_FLASHCARDS = (content) => `...`;
exports.EXTRACT_FLASHCARDS = EXTRACT_FLASHCARDS;
/**
 * Prompt to generate relevant subject tags from content.
 * Expects a JSON response: { "tags": ["tag1", "tag2", ...] }
 */
const generateTagsBase = `
Analyze the following content and identify 3-5 concise, relevant subject tags or keywords that accurately represent the main topics.
Focus on specific concepts, disciplines, or key entities mentioned.
Avoid overly generic terms unless they are central to the theme.
**IMPORTANT:** Generate the tags themselves in the language specified by the language code: **{LANGUAGE_CODE}**.
(Note: {LANGUAGE_CODE} should be the 3-letter ISO 639-3 code, e.g., 'eng', 'spa', 'fra')

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
const GENERATE_TAGS = (content) => {
    // Ensure content doesn't break the prompt structure
    const safeContent = content.replace(/`/g, "'"); // Basic backtick escaping
    return generateTagsBase + safeContent + generateTagsClosing;
};
exports.GENERATE_TAGS = GENERATE_TAGS;
