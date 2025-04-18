/**
 * Defines the types/names of jobs that can be added to the queue.
 * Using an enum or const object helps prevent typos.
 */
export const JobType = {
  PROCESS_TEXT: 'PROCESS_TEXT',
  PROCESS_AUDIO: 'PROCESS_AUDIO',
  PROCESS_PDF: 'PROCESS_PDF', // Added for PDF processing
  PROCESS_IMAGE: 'PROCESS_IMAGE', // Added for image processing
  // PROCESS_YOUTUBE: 'PROCESS_YOUTUBE', // Future
  // PROCESS_IMAGE: 'PROCESS_IMAGE', // Future
  TRANSCRIBE_AUDIO: 'TRANSCRIBE_AUDIO',
  GENERATE_NOTES: 'GENERATE_NOTES',
  PROCESS_SOURCE_TEXT: 'PROCESS_SOURCE_TEXT',
  PROCESS_AUDIO_TRANSCRIPTION: 'PROCESS_AUDIO_TRANSCRIPTION',
  PROCESS_VISUAL_PLACEHOLDERS: 'PROCESS_VISUAL_PLACEHOLDERS',
  GENERATE_VISUAL: 'GENERATE_VISUAL',
  ASSEMBLE_NOTE: 'ASSEMBLE_NOTE',
  GENERATE_STUDY_TOOLS: 'GENERATE_STUDY_TOOLS',
  // Add other job types here (e.g., TRANSCRIBE_AUDIO)
} as const; // Use 'as const' for stricter typing

export type JobName = typeof JobType[keyof typeof JobType];

// Define payload types for each job if needed
export interface ProcessSourceTextPayload {
  sourceId: number;
}

export interface ProcessAudioTranscriptionPayload {
  sourceId: number;
  languageCode?: string;
}

export interface ProcessPdfPayload {
  sourceId: number;
}

export interface ProcessImagePayload {
  sourceId: number;
}

export interface ProcessVisualPlaceholdersPayload {
    sourceId: number;
}

export interface GenerateVisualPayload {
    visualId: number; 
    sourceId: number; // Useful for potential grouping/cancellation
}

export interface AssembleNotePayload {
    sourceId: number;
}

export interface GenerateStudyToolsPayload {
    noteId: number;
}

/**
 * Defines the expected payload structure for each job type.
 * Use this to ensure type safety when creating and processing jobs.
 */
export type JobPayload = {
  [JobType.PROCESS_TEXT]: { sourceId: string };
  [JobType.PROCESS_AUDIO]: { sourceId: string; languageCode?: string };
  [JobType.PROCESS_PDF]: { sourceId: number };
  // [JobType.PROCESS_YOUTUBE]: { sourceId: string; youtubeUrl: string };
  // [JobType.PROCESS_IMAGE]: { sourceId: string };
  [JobType.TRANSCRIBE_AUDIO]: { sourceId: string; storagePath: string; languageCode?: string };
  [JobType.GENERATE_NOTES]: { noteId: string };
  [JobType.PROCESS_SOURCE_TEXT]: ProcessSourceTextPayload; // Reusing defined interface
  [JobType.PROCESS_AUDIO_TRANSCRIPTION]: ProcessAudioTranscriptionPayload;
  [JobType.PROCESS_VISUAL_PLACEHOLDERS]: ProcessVisualPlaceholdersPayload;
  [JobType.GENERATE_VISUAL]: GenerateVisualPayload;
  [JobType.ASSEMBLE_NOTE]: AssembleNotePayload;
  [JobType.GENERATE_STUDY_TOOLS]: GenerateStudyToolsPayload;
}; 