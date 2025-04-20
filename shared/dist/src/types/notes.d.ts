export type NoteSourceType = 'PDF' | 'YOUTUBE' | 'AUDIO' | 'IMAGE' | 'TEXT';
export interface Tag {
    id: number;
    name: string;
}
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
export interface NoteDetail extends Omit<NoteListItem, 'sourceType'> {
    markdownContent?: string | null;
    htmlContent?: string | null;
    sourceType: NoteSourceType | null;
}
export interface GetNotesParams {
    limit?: number;
    offset?: number;
    favorite?: boolean;
    folderId?: number | null;
    sourceType?: NoteSourceType;
}
export interface GetNotesResponse {
    notes: NoteListItem[];
    total: number;
}
export interface UpdateNoteInput {
    favorite?: boolean;
    folderId?: number | null;
}
export interface UpdateNoteResponse {
    id: number;
    title?: string;
    updatedAt: string;
    favorite?: boolean;
    folderId?: number | null;
}
//# sourceMappingURL=notes.d.ts.map