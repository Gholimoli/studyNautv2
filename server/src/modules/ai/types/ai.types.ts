import { z } from 'zod';

// --- Generic AI Request/Response --- 

export interface AiRequestOptions {
  systemPrompt?: string;
  maxOutputTokens?: number;
  temperature?: number; // 0.0 - 1.0 (higher means more creative/random)
  jsonMode?: boolean; // Hint to the provider to output valid JSON
}

export interface AiResponse {
  content: string | null; // Text content
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  errorMessage?: string; // If an error occurred during generation
  // visualContent?: Buffer | string; // For models that generate visuals (e.g., base64 string or Buffer)
}

export interface IAiProvider {
  readonly providerName: string;
  generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse>;
  // generateVisual?(prompt: string, options?: AiRequestOptions): Promise<AiResponse>; // Optional visual generation
}

// --- Task-Specific AI Output Schemas (using Zod for validation) ---

// Define allowed content types as a Zod enum first
const lessonBlockContentTypeSchema = z.enum([
  'heading',
  'paragraph',
  'list',
  'code_block',
  'definition',
  'key_takeaway_box',
  'note_box',
  'highlight_box',
  'qa',
  'visual_placeholder', // Placeholder inserted by AI during generation
  'explanation',        // Added based on potential AI output
  'example',            // Added based on potential AI output
  'conclusion',         // Added based on potential AI output
  'visual',             // Added for hydrated visuals
  'placeholder',        // Added for failed/missing visuals
]);

// Infer the TypeScript type from the Zod enum
type LessonBlockContentType = z.infer<typeof lessonBlockContentTypeSchema>;

// Base schema for all lesson blocks
const baseLessonBlockSchema = z.object({
  contentType: lessonBlockContentTypeSchema,
  content: z.string().optional(),       // Optional for container types like list, qa
  items: z.array(z.string()).optional(), // For lists
  question: z.string().optional(),      // For QA
  answer: z.string().optional(),        // For QA
  term: z.string().optional(),          // For definition
  definition: z.string().optional(),    // For definition
  level: z.number().int().min(1).max(6).nullable().optional(), // Allow null for level
  language: z.string().optional(),      // For code blocks
  placeholderId: z.string().optional(), // For visual_placeholder
  description: z.string().optional(),   // For visual_placeholder, key_takeaway_box, note_box, highlight_box
  // --- Added for hydrated/failed visuals ---
  imageUrl: z.string().url().optional(), // For visual
  altText: z.string().optional(),        // For visual
  sourceUrl: z.string().url().optional(), // For visual
  sourceTitle: z.string().optional(),    // For visual
  reason: z.string().optional(),         // For placeholder
  // ----------------------------------------
});

// Recursive type definition for LessonBlock
export type LessonBlock = z.infer<typeof baseLessonBlockSchema> & {
  subStructure?: LessonBlock[];
};

// Recursive schema for LessonBlock
export const lessonBlockSchema: z.ZodType<LessonBlock> = baseLessonBlockSchema.extend(
  {
    subStructure: z.lazy(() => z.array(lessonBlockSchema)).optional(),
  },
);

// Schema for the main AI-generated structure
export const aiStructuredContentSchema = z.object({
  title: z.string(),
  summary: z.string(),
  structure: z.array(lessonBlockSchema), // Array of LessonBlocks
  visualOpportunities: z.array(z.object({
    placeholderId: z.string(),
    concept: z.string(),
    description: z.string(),
    searchQuery: z.string(),
  })).optional(), // Added visualOpportunities as optional array
});

// Type for the main AI-generated structure
export type AiStructuredContent = z.infer<typeof aiStructuredContentSchema>;

// Schema for a Quiz Question
export const aiQuizQuestionSchema = z.object({
    question: z.string(),
    options: z.array(z.string()).length(4, 'Must have exactly 4 options'), // Example: Fixed 4 options
    correctAnswerIndex: z.number().min(0).max(3),
    explanation: z.string().optional(),
});
export type AiQuizQuestion = z.infer<typeof aiQuizQuestionSchema>;

// Schema for a Quiz
export const aiQuizSchema = z.object({
    questions: z.array(aiQuizQuestionSchema),
});
export type AiQuiz = z.infer<typeof aiQuizSchema>;

// Schema for a Flashcard
export const aiFlashcardSchema = z.object({
    term: z.string(),
    definition: z.string(),
});
export type AiFlashcard = z.infer<typeof aiFlashcardSchema>;

export const aiFlashcardsSchema = z.object({
    flashcards: z.array(aiFlashcardSchema),
});
export type AiFlashcards = z.infer<typeof aiFlashcardsSchema>;

// Type for the expected JSON response for tag generation
export interface AiTagResponse {
  tags: string[];
}

// --- Configuration Types ---

export type AiProviderType = 'gemini' | 'openai' | string; // Allow custom strings
export type VisualProviderType = 'serpapi' | 'gemini' | string; // Allow Gemini for visual later 