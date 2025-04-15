/**
 * Defines the types/names of jobs that can be added to the queue.
 * Using an enum or const object helps prevent typos.
 */
export const JobType = {
  PROCESS_SOURCE_TEXT: 'PROCESS_SOURCE_TEXT',
  PROCESS_AUDIO_TRANSCRIPTION: 'PROCESS_AUDIO_TRANSCRIPTION',
  PROCESS_VISUAL_PLACEHOLDERS: 'PROCESS_VISUAL_PLACEHOLDERS',
  GENERATE_VISUAL: 'GENERATE_VISUAL',
  ASSEMBLE_NOTE: 'ASSEMBLE_NOTE',
  GENERATE_STUDY_TOOLS: 'GENERATE_STUDY_TOOLS',
  // Add other job types here (e.g., TRANSCRIBE_AUDIO)
} as const; // Use 'as const' for stricter typing

export type JobName = keyof typeof JobType;

// Define payload types for each job if needed
export interface ProcessSourceTextPayload {
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