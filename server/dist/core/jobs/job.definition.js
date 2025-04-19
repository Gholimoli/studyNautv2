"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobType = void 0;
/**
 * Defines the types/names of jobs that can be added to the queue.
 * Using an enum or const object helps prevent typos.
 */
exports.JobType = {
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
}; // Use 'as const' for stricter typing
