/**
 * Defines the types/names of jobs that can be added to the queue.
 * Using an enum or const object helps prevent typos.
 */
export declare const JobType: {
    readonly PROCESS_SOURCE_TEXT: "PROCESS_SOURCE_TEXT";
    readonly PROCESS_AUDIO_TRANSCRIPTION: "PROCESS_AUDIO_TRANSCRIPTION";
    readonly PROCESS_VISUAL_PLACEHOLDERS: "PROCESS_VISUAL_PLACEHOLDERS";
    readonly GENERATE_VISUAL: "GENERATE_VISUAL";
    readonly ASSEMBLE_NOTE: "ASSEMBLE_NOTE";
    readonly GENERATE_STUDY_TOOLS: "GENERATE_STUDY_TOOLS";
};
export type JobName = keyof typeof JobType;
export interface ProcessSourceTextPayload {
    sourceId: number;
}
export interface ProcessVisualPlaceholdersPayload {
    sourceId: number;
}
export interface GenerateVisualPayload {
    visualId: number;
    sourceId: number;
}
export interface AssembleNotePayload {
    sourceId: number;
}
export interface GenerateStudyToolsPayload {
    noteId: number;
}
