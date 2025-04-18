// Shared type definitions for Notes

// Use UPPERCASE consistently based on API and NoteCard expectation
export type NoteSourceType = 'PDF' | 'YOUTUBE' | 'AUDIO' | 'IMAGE' | 'TEXT';

export interface Tag {
  id: number;
  name: string;
}

// Represents a minimal note for list views
export interface NoteListItem {
  id: number;
  sourceId: number;
  userId: number;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  sourceType: NoteSourceType;
  tags?: Tag[];
  folderId?: number | null;
  languageCode?: string | null;
}

// Represents the detailed view of a note
export interface NoteDetail extends Omit<NoteListItem, 'sourceType'> {
  markdownContent?: string | null;
  htmlContent?: string | null;
  // languageCode is already in NoteListItem
  sourceType: NoteSourceType | null; // Allow null if source type somehow missing?
  // summary is already in NoteListItem
  // tags is already in NoteListItem
}

// Parameters for fetching notes list
export interface GetNotesParams {
  limit?: number;
  offset?: number;
  favorite?: boolean;
  folderId?: number | null; // Allow null for root notes
  sourceType?: NoteSourceType;
  // Add other potential filters like search query later
}

// Response shape for GET /api/notes
export interface GetNotesResponse {
  notes: NoteListItem[];
  total: number;
}

// Input payload for PATCH /api/notes/:id
export interface UpdateNoteInput {
  favorite?: boolean;
  folderId?: number | null; // Allow setting/unsetting folderId
  // Add other updatable fields like title if needed
}

// Response shape for PATCH /api/notes/:id
// Adjust based on actual API return value
export interface UpdateNoteResponse {
    id: number;
    title?: string; // Make optional if not always returned
    updatedAt: string;
    favorite?: boolean;
    folderId?: number | null;
}

// We can add other shared Note-related types here later if needed 