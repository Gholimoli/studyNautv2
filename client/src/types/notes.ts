// Shared type definitions for Notes

// Use UPPERCASE consistently based on API and NoteCard expectation
export type NoteSourceType = 'PDF' | 'YOUTUBE' | 'AUDIO' | 'IMAGE' | 'TEXT';

export interface Tag {
  id: number;
  name: string;
}

// We can add other shared Note-related types here later if needed 