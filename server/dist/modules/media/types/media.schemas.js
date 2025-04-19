"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessPdfUrlDtoSchema = exports.ProcessAudioDtoSchema = exports.ProcessTextDtoSchema = void 0;
const zod_1 = require("zod");
exports.ProcessTextDtoSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'Text cannot be empty'),
    title: zod_1.z.string().optional(), // Optional title for the note
});
// Schema for processing audio (currently empty as primary data is in the file)
// We might add metadata here later if needed, e.g., title
exports.ProcessAudioDtoSchema = zod_1.z.object({
    languageCode: zod_1.z.string().optional(), // Optional language code (e.g., 'eng', 'spa')
});
// Schema for processing a PDF URL
exports.ProcessPdfUrlDtoSchema = zod_1.z.object({
    url: zod_1.z.string().url('Invalid URL format'), // Ensure it's a valid URL
});
// Add schemas for file upload, youtube url later 
