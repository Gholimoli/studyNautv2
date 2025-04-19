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

// Schema for a single block in the lesson structure
export const lessonBlockSchema = z.object({
  contentType: z.enum([
    'heading',
    'paragraph',
    'bullet_list',
    'code_block',
    'advanced_code_block',
    'definition',
    'key_takeaway_box',
    'callout_info',
    'visual_placeholder',
    'introduction',
    'explanation',
    'example',
  ]),
  content: z.string().nullable().optional(),
  level: z.number().nullable().optional(), // Heading level (1, 2, 3...)
  items: z.array(z.string()).nullable().optional(), // Only for 'bullet_list'
  keyPoints: z.array(z.string()).nullable().optional(), // Added: Only for 'key_takeaway_box'
  placeholderId: z.string().nullable().optional(), // Only for 'visual_placeholder'
});
export type LessonBlock = z.infer<typeof lessonBlockSchema>;

// Schema for the overall lesson structure returned by AI
export const aiStructuredContentSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  summary: z.string().nullable().optional(),
  structure: z.array(lessonBlockSchema),
  visualOpportunities: z
    .array(
      z.object({
        placeholderId: z.string(), // ID matching a placeholder in the structure
        concept: z.string(), // Added: Specific concept the visual illustrates
        description: z.string(), // Detailed description of the desired visual
        searchQuery: z.string(), // Changed: Now required - Optimized query for image search
      })
    )
    .nullable()
    .optional(),
});
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