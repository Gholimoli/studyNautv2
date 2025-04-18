import { z } from 'zod';

export const ProcessTextDtoSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty'),
  title: z.string().optional(), // Optional title for the note
});

export type ProcessTextDto = z.infer<typeof ProcessTextDtoSchema>;

// Schema for processing audio (currently empty as primary data is in the file)
// We might add metadata here later if needed, e.g., title
export const ProcessAudioDtoSchema = z.object({
  languageCode: z.string().optional(), // Optional language code (e.g., 'eng', 'spa')
});

export type ProcessAudioDto = z.infer<typeof ProcessAudioDtoSchema>;

// Schema for processing a PDF URL
export const ProcessPdfUrlDtoSchema = z.object({
  url: z.string().url('Invalid URL format'), // Ensure it's a valid URL
});

export type ProcessPdfUrlDto = z.infer<typeof ProcessPdfUrlDtoSchema>;

// Add schemas for file upload, youtube url later 