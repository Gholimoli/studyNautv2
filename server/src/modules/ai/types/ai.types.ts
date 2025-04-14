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
  type: z.enum(['heading', 'subheading', 'paragraph', 'bullet_list', 'key_term', 'visual_placeholder']), // Added visual_placeholder
  content: z.string(),
  level: z.number().optional(), // For headings (e.g., 1, 2, 3)
  items: z.array(z.string()).optional(), // For bullet_list
  placeholderId: z.string().optional(), // ID for visual_placeholder type, e.g., VISUAL_1
});
export type LessonBlock = z.infer<typeof lessonBlockSchema>;

// Schema for the overall lesson structure returned by AI
export const aiStructuredContentSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  summary: z.string().optional(), // Optional brief summary
  structure: z.array(lessonBlockSchema),
  visualOpportunities: z.array(z.object({ 
      placeholderId: z.string(), // ID matching a placeholder in the structure
      description: z.string(),   // Description of the desired visual
      searchQuery: z.string().optional(), // Optional optimized query for image search
  })).optional(),
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


// --- Configuration Types ---

export type AiProviderType = 'gemini' | 'openai' | string; // Allow custom strings
export type VisualProviderType = 'serpapi' | 'gemini' | string; // Allow Gemini for visual later 