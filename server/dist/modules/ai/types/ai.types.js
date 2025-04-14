"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiFlashcardsSchema = exports.aiFlashcardSchema = exports.aiQuizSchema = exports.aiQuizQuestionSchema = exports.aiStructuredContentSchema = exports.lessonBlockSchema = void 0;
const zod_1 = require("zod");
// --- Task-Specific AI Output Schemas (using Zod for validation) ---
// Schema for a single block in the lesson structure
exports.lessonBlockSchema = zod_1.z.object({
    type: zod_1.z.enum(['heading', 'subheading', 'paragraph', 'bullet_list', 'key_term', 'visual_placeholder']), // Added visual_placeholder
    content: zod_1.z.string(),
    level: zod_1.z.number().nullable().optional(), // Allow number, null, or undefined
    items: zod_1.z.array(zod_1.z.string()).nullable().optional(), // Allow array, null, or undefined
    placeholderId: zod_1.z.string().nullable().optional(), // Allow string, null, or undefined
});
// Schema for the overall lesson structure returned by AI
exports.aiStructuredContentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title cannot be empty'),
    summary: zod_1.z.string().optional(), // Optional brief summary
    structure: zod_1.z.array(exports.lessonBlockSchema),
    visualOpportunities: zod_1.z.array(zod_1.z.object({
        placeholderId: zod_1.z.string(), // ID matching a placeholder in the structure
        description: zod_1.z.string(), // Description of the desired visual
        searchQuery: zod_1.z.string().optional(), // Optional optimized query for image search
    })).optional(),
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
