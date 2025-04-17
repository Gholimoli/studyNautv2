import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AppError } from '@/types/errors';
import { toast } from 'sonner';

// Define the expected shape of a single note in the list
// Keep this minimal for the list view, detailed view can fetch more
interface NoteListItem {
  id: number;
  sourceId: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
}

// Define the expected shape of the API response
interface GetNotesResponse {
  notes: NoteListItem[];
  total: number;
}

// Function to fetch notes from the API
const fetchNotes = async (): Promise<GetNotesResponse> => {
  const response = await apiClient.get('/notes'); // Add query params later if needed (pagination, filters)
  return response.data;
};

// Hook to fetch the list of notes
export function useGetNotesQuery() {
  return useQuery<GetNotesResponse, Error>({
    queryKey: ['notes'], // Query key for caching
    queryFn: fetchNotes,
    // Optional: Add staleTime or other options as needed
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Define the expected shape for a single detailed note
interface NoteDetail extends Omit<NoteListItem, 'sourceType'> { // Remove sourceType from extension
  markdownContent?: string;
  htmlContent?: string;
  originalTranscript?: string; // If applicable
  tags?: { id: number; name: string }[]; // Added tags property
  // Add other fields returned by the GET /api/notes/:id endpoint
}

// Function to fetch a single note by ID
const fetchNoteById = async (noteId: string): Promise<NoteDetail> => {
  if (!noteId) {
    throw new Error('Note ID is required to fetch details.');
  }
  const response = await apiClient.get(`/notes/${noteId}`);
  return response.data;
};

// Hook to fetch a single note by ID
export function useGetNoteByIdQuery(noteId: string | undefined) {
  return useQuery<NoteDetail, Error>({
    // Query key includes the noteId to ensure uniqueness
    queryKey: ['note', noteId],
    // Only run the query if noteId is available
    queryFn: () => fetchNoteById(noteId!),
    enabled: !!noteId, // Ensures the query doesn't run until noteId is defined
    // Optional: Add staleTime or other options
  });
}

// Define the detailed note type (ensure it matches backend response for PATCH)
// Might need adjustment based on what PATCH /api/notes/:id actually returns
interface UpdatedNoteResponse {
    id: number;
    title: string;
    updatedAt: string;
    // Add other fields if returned by the PATCH endpoint
    favorite?: boolean;
    folderId?: number | null;
}

// --- Mutations --- 

// Input type for the update mutation
export interface UpdateNoteInput {
  favorite?: boolean;
  folderId?: number | null; // Allow setting folderId
  // Add other fields like title, content if needed later
}

// API function to update a note
const updateNote = async ({ noteId, input }: { noteId: number; input: UpdateNoteInput }): Promise<UpdatedNoteResponse> => {
    try {
        const response = await apiClient.patch<UpdatedNoteResponse>(`/notes/${noteId}`, input);
        return response.data;
    } catch (error: any) {
        console.error(`Error updating note ${noteId}:`, error);
        throw new AppError(
            error.response?.status || '500',
            error.response?.data?.message || 'Failed to update note'
        );
    }
};

/**
 * TanStack Query hook to update a note.
 */
export function useUpdateNote() {
    const queryClient = useQueryClient();

    return useMutation<UpdatedNoteResponse, AppError, { noteId: number; input: UpdateNoteInput }>({
        mutationFn: updateNote,
        onSuccess: (data, variables) => {
            // Invalidate queries to refetch data after update
            // Invalidate the specific note detail query
            queryClient.invalidateQueries({ queryKey: ['note', variables.noteId] });
            // Invalidate the notes list query
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            // Consider invalidating folder queries if note counts change
            queryClient.invalidateQueries({ queryKey: ['folders'] });

            toast.success(`Note "${data.title}" updated successfully.`);
            console.log('Note updated successfully, ID:', variables.noteId);
        },
        onError: (error, variables) => {
            toast.error(error.message || 'Failed to update note.');
            console.error(`Note update failed for ID ${variables.noteId}:`, error);
        },
    });
} 