import { apiClient } from "@/lib/api-client";
import { 
    GetNotesParams, 
    GetNotesResponse, 
    NoteDetail, 
    UpdateNoteResponse, 
    UpdateNoteInput // Import this from shared types if not already done in useNotesQueries
} from "@shared/types/notes"; 
import { AppError } from "@shared/types/errors"; // Assuming AppError might be needed for error typing

/**
 * Fetch a list of notes based on parameters.
 */
export async function fetchNotes(params?: GetNotesParams): Promise<GetNotesResponse> {
    try {
        const response = await apiClient.get<GetNotesResponse>('/notes', { params });
        // console.log('[fetchNotes] API Response:', response.data); 
        return response.data;
    } catch (error: any) {
        console.error("[fetchNotes] API Error:", error);
        throw new AppError(error.response?.data?.message || 'Failed to fetch notes', error.response?.status);
    }
}

/**
 * Fetch details for a single note by ID.
 */
export async function fetchNoteById(noteId: string): Promise<NoteDetail> {
     try {
        const response = await apiClient.get<NoteDetail>(`/notes/${noteId}`);
        // console.log('[fetchNoteById] API Response:', response.data); 
        return response.data;
    } catch (error: any) {
        console.error(`[fetchNoteById] API Error for ID ${noteId}:`, error);
        throw new AppError(error.response?.data?.message || 'Failed to fetch note details', error.response?.status);
    }
}

/**
 * Update a note.
 * Corresponds to PATCH /api/notes/:id
 */
export async function updateNote({ noteId, input }: { noteId: number; input: UpdateNoteInput }): Promise<UpdateNoteResponse> {
    try {
        const response = await apiClient.patch<UpdateNoteResponse>(`/notes/${noteId}`, input);
        // console.log('[updateNote] API Response:', response.data);
        return response.data;
    } catch (error: any) {
        console.error(`[updateNote] API Error for ID ${noteId}:`, error);
        throw new AppError(error.response?.data?.message || 'Failed to update note', error.response?.status);
    }
}

/**
 * Delete a note by ID.
 * Corresponds to DELETE /api/notes/:id
 */
export async function deleteNoteApi(noteId: number): Promise<void> {
     try {
        const response = await apiClient.delete<void>(`/notes/${noteId}`);
        // console.log('[deleteNoteApi] Success for ID:', noteId);
        // DELETE typically returns 204 No Content, so no data to return
        return; 
    } catch (error: any) {
        console.error(`[deleteNoteApi] API Error for ID ${noteId}:`, error);
        throw new AppError(error.response?.data?.message || 'Failed to delete note', error.response?.status);
    }
} 