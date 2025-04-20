"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiFlashcardsSchema = exports.aiFlashcardSchema = exports.aiQuizSchema = exports.aiQuizQuestionSchema = exports.aiStructuredContentSchema = exports.lessonBlockSchema = void 0;
const zod_1 = require("zod");
// --- Task-Specific AI Output Schemas (using Zod for validation) ---
// Define allowed content types as a Zod enum first
const lessonBlockContentTypeSchema = zod_1.z.enum([
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
    'explanation', // Added based on potential AI output
    'example', // Added based on potential AI output
    'conclusion', // Added based on potential AI output
    'visual', // Added for hydrated visuals
    'placeholder', // Added for failed/missing visuals
]);
// Base schema for all lesson blocks
const baseLessonBlockSchema = zod_1.z.object({
    contentType: lessonBlockContentTypeSchema,
    content: zod_1.z.string().optional(), // Optional for container types like list, qa
    items: zod_1.z.array(zod_1.z.string()).optional(), // For lists
    question: zod_1.z.string().optional(), // For QA
    answer: zod_1.z.string().optional(), // For QA
    term: zod_1.z.string().optional(), // For definition
    definition: zod_1.z.string().optional(), // For definition
    level: zod_1.z.number().int().min(1).max(6).nullable().optional(), // Allow null for level
    language: zod_1.z.string().optional(), // For code blocks
    placeholderId: zod_1.z.string().optional(), // For visual_placeholder
    description: zod_1.z.string().optional(), // For visual_placeholder, key_takeaway_box, note_box, highlight_box
    // --- Added for hydrated/failed visuals ---
    imageUrl: zod_1.z.string().url().optional(), // For visual
    altText: zod_1.z.string().optional(), // For visual
    sourceUrl: zod_1.z.string().url().optional(), // For visual
    sourceTitle: zod_1.z.string().optional(), // For visual
    reason: zod_1.z.string().optional(), // For placeholder
    // ----------------------------------------
});
// Recursive schema for LessonBlock
exports.lessonBlockSchema = baseLessonBlockSchema.extend({
    subStructure: zod_1.z.lazy(() => zod_1.z.array(exports.lessonBlockSchema)).optional(),
});
// Schema for the main AI-generated structure
exports.aiStructuredContentSchema = zod_1.z.object({
    title: zod_1.z.string(),
    summary: zod_1.z.string(),
    structure: zod_1.z.array(exports.lessonBlockSchema), // Array of LessonBlocks
    visualOpportunities: zod_1.z.array(zod_1.z.object({
        placeholderId: zod_1.z.string(),
        concept: zod_1.z.string(),
        description: zod_1.z.string(),
        searchQuery: zod_1.z.string(),
    })).optional(), // Added visualOpportunities as optional array
});
// Schema for a Quiz Question
exports.aiQuizQuestionSchema = zod_1.z.object({
    question: zod_1.z.string(),
    options: zod_1.z.array(zod_1.z.string()).length(4, 'Must have exactly 4 options'), // Example: Fixed 4 options
    correctAnswerIndex: zod_1.z.number().min(0).max(3),
    explanation: zod_1.z.string().optional(),
});
// Schema for a Quiz
exports.aiQuizSchema = zod_1.z.object({
    questions: zod_1.z.array(exports.aiQuizQuestionSchema),
});
// Schema for a Flashcard
exports.aiFlashcardSchema = zod_1.z.object({
    term: zod_1.z.string(),
    definition: zod_1.z.string(),
});
exports.aiFlashcardsSchema = zod_1.z.object({
    flashcards: zod_1.z.array(exports.aiFlashcardSchema),
});
