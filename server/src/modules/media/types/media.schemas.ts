import { z } from 'zod';

export const processTextSchema = z.object({
  text: z.string().min(10, 'Text must be at least 10 characters long'), // Basic validation
  title: z.string().optional(), // Optional title provided by user
});

export type ProcessTextDto = z.infer<typeof processTextSchema>;

// Add schemas for file upload, youtube url later 