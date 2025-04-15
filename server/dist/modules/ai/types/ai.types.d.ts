import { z } from 'zod';
export interface AiRequestOptions {
    systemPrompt?: string;
    maxOutputTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
}
export interface AiResponse {
    content: string | null;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    errorMessage?: string;
}
export interface IAiProvider {
    readonly providerName: string;
    generateText(prompt: string, options?: AiRequestOptions): Promise<AiResponse>;
}
export declare const lessonBlockSchema: z.ZodObject<{
    type: z.ZodEnum<["heading", "subheading", "paragraph", "bullet_list", "key_term", "visual_placeholder"]>;
    content: z.ZodOptional<z.ZodString>;
    level: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    items: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    placeholderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "heading" | "subheading" | "paragraph" | "bullet_list" | "key_term" | "visual_placeholder";
    placeholderId?: string | null | undefined;
    content?: string | undefined;
    level?: number | null | undefined;
    items?: string[] | null | undefined;
}, {
    type: "heading" | "subheading" | "paragraph" | "bullet_list" | "key_term" | "visual_placeholder";
    placeholderId?: string | null | undefined;
    content?: string | undefined;
    level?: number | null | undefined;
    items?: string[] | null | undefined;
}>;
export type LessonBlock = z.infer<typeof lessonBlockSchema>;
export declare const aiStructuredContentSchema: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    structure: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["heading", "subheading", "paragraph", "bullet_list", "key_term", "visual_placeholder"]>;
        content: z.ZodOptional<z.ZodString>;
        level: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        items: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
        placeholderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "heading" | "subheading" | "paragraph" | "bullet_list" | "key_term" | "visual_placeholder";
        placeholderId?: string | null | undefined;
        content?: string | undefined;
        level?: number | null | undefined;
        items?: string[] | null | undefined;
    }, {
        type: "heading" | "subheading" | "paragraph" | "bullet_list" | "key_term" | "visual_placeholder";
        placeholderId?: string | null | undefined;
        content?: string | undefined;
        level?: number | null | undefined;
        items?: string[] | null | undefined;
    }>, "many">;
    visualOpportunities: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        placeholderId: z.ZodString;
        description: z.ZodString;
        searchQuery: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        placeholderId: string;
        description: string;
        searchQuery?: string | undefined;
    }, {
        placeholderId: string;
        description: string;
        searchQuery?: string | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    structure: {
        type: "heading" | "subheading" | "paragraph" | "bullet_list" | "key_term" | "visual_placeholder";
        placeholderId?: string | null | undefined;
        content?: string | undefined;
        level?: number | null | undefined;
        items?: string[] | null | undefined;
    }[];
    summary?: string | null | undefined;
    visualOpportunities?: {
        placeholderId: string;
        description: string;
        searchQuery?: string | undefined;
    }[] | null | undefined;
}, {
    title: string;
    structure: {
        type: "heading" | "subheading" | "paragraph" | "bullet_list" | "key_term" | "visual_placeholder";
        placeholderId?: string | null | undefined;
        content?: string | undefined;
        level?: number | null | undefined;
        items?: string[] | null | undefined;
    }[];
    summary?: string | null | undefined;
    visualOpportunities?: {
        placeholderId: string;
        description: string;
        searchQuery?: string | undefined;
    }[] | null | undefined;
}>;
export type AiStructuredContent = z.infer<typeof aiStructuredContentSchema>;
export declare const aiQuizQuestionSchema: z.ZodObject<{
    question: z.ZodString;
    options: z.ZodArray<z.ZodString, "many">;
    correctAnswerIndex: z.ZodNumber;
    explanation: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    options: string[];
    question: string;
    correctAnswerIndex: number;
    explanation?: string | undefined;
}, {
    options: string[];
    question: string;
    correctAnswerIndex: number;
    explanation?: string | undefined;
}>;
export type AiQuizQuestion = z.infer<typeof aiQuizQuestionSchema>;
export declare const aiQuizSchema: z.ZodObject<{
    questions: z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        options: z.ZodArray<z.ZodString, "many">;
        correctAnswerIndex: z.ZodNumber;
        explanation: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        options: string[];
        question: string;
        correctAnswerIndex: number;
        explanation?: string | undefined;
    }, {
        options: string[];
        question: string;
        correctAnswerIndex: number;
        explanation?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    questions: {
        options: string[];
        question: string;
        correctAnswerIndex: number;
        explanation?: string | undefined;
    }[];
}, {
    questions: {
        options: string[];
        question: string;
        correctAnswerIndex: number;
        explanation?: string | undefined;
    }[];
}>;
export type AiQuiz = z.infer<typeof aiQuizSchema>;
export declare const aiFlashcardSchema: z.ZodObject<{
    term: z.ZodString;
    definition: z.ZodString;
}, "strip", z.ZodTypeAny, {
    term: string;
    definition: string;
}, {
    term: string;
    definition: string;
}>;
export type AiFlashcard = z.infer<typeof aiFlashcardSchema>;
export declare const aiFlashcardsSchema: z.ZodObject<{
    flashcards: z.ZodArray<z.ZodObject<{
        term: z.ZodString;
        definition: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        term: string;
        definition: string;
    }, {
        term: string;
        definition: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    flashcards: {
        term: string;
        definition: string;
    }[];
}, {
    flashcards: {
        term: string;
        definition: string;
    }[];
}>;
export type AiFlashcards = z.infer<typeof aiFlashcardsSchema>;
export type AiProviderType = 'gemini' | 'openai' | string;
export type VisualProviderType = 'serpapi' | 'gemini' | string;
