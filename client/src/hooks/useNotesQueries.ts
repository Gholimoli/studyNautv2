import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AppError } from '@/types/errors';
import { toast } from 'sonner';

// Define the expected shape of a single note in the list
// Keep this minimal for the list view, detailed view can fetch more
export interface NoteListItem {
  id: number;
  sourceId: number;
  userId: number;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  sourceType: 'YOUTUBE' | 'TEXT' | 'AUDIO' | 'PDF' | 'IMAGE'; // Added sourceType
  tags?: { id: number; name: string }[]; // Added optional tags array
  folderId?: number | null; // ADD folderId
  languageCode?: string | null; // Add languageCode
}

// Define the expected shape of the API response
interface GetNotesResponse {
  notes: NoteListItem[];
  total: number;
}

// Define the type for query parameters
export interface GetNotesParams {
  limit?: number;
  offset?: number;
  favorite?: boolean;
  folderId?: number;
  sourceType?: 'YOUTUBE' | 'TEXT' | 'AUDIO' | 'PDF' | 'IMAGE';
  // Add other potential filters like search query later
}

// Function to build a stable query key for notes
function getNotesQueryKey(params?: GetNotesParams) {
  const key = [
    'notes',
    params?.folderId ?? null,
    params?.favorite ?? null,
    params?.sourceType ?? null,
    // Add more params as needed
  ];
  // console.log('[getNotesQueryKey] Generated Key:', key); // Optional: Log key generation
  return key;
}

// Function to fetch notes from the API, now with parameters
const fetchNotes = async (params?: GetNotesParams): Promise<GetNotesResponse> => {
  // ADD LOG HERE
  console.log(`%c[fetchNotes] Received params object:`, 'color: green; font-weight: bold;', params);

  // Build query string from params
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) { 
        queryParams.append(key, String(value));
      }
    });
  }
  const queryString = queryParams.toString();
  const url = queryString ? `/notes?${queryString}` : '/notes';
  
  console.log(`%c[fetchNotes] Fetching URL:`, 'color: green; font-weight: bold;', url); // Log the final URL
  
  const response = await apiClient.get(url);
  return response.data;
};

// Hook to fetch the list of notes, now accepting parameters
export function useGetNotesQuery(params?: GetNotesParams) {
  const queryKey = getNotesQueryKey(params);
  // ADD LOGGING HERE
  console.log(`%c[useGetNotesQuery] Using queryKey:`, 'color: blue; font-weight: bold;', queryKey, 'for params:', params);
  
  return useQuery<GetNotesResponse, Error>({
    queryKey,
    queryFn: () => fetchNotes(params),
    // Set staleTime to 0 to ensure data is always considered stale
    // This encourages refetching on mount/window focus after invalidation
    staleTime: 0, 
    // Optional: Keep defaults for refetchOnMount, refetchOnWindowFocus (true)
  });
}

// Define the expected shape for a single detailed note
interface NoteDetail extends Omit<NoteListItem, 'sourceType'> { // Remove sourceType from extension
  markdownContent?: string | null;
  htmlContent?: string | null;
  languageCode?: string | null;
  sourceType: 'YOUTUBE' | 'TEXT' | 'AUDIO' | 'PDF' | 'IMAGE' | null; // Allow null
  // Add summary consistent with NoteListItem
  summary?: string; // Changed from string | null to match NoteListItem
  // originalTranscript?: string; // If applicable
  // tags is already in NoteListItem, no need to repeat unless different type
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

// Type for the context returned by onMutate in useUpdateNote
interface UpdateNoteOptimisticContext {
  previousNotes?: GetNotesResponse;
  previousNoteDetail?: NoteDetail;
  previousFavoriteNotes?: GetNotesResponse; // Add context for favorites list
}

/**
 * TanStack Query hook to update a note.
 */
export function useUpdateNote() {
    const queryClient = useQueryClient();

    // Explicitly type the mutation hook including the context type
    return useMutation<UpdatedNoteResponse, AppError, { noteId: number; input: UpdateNoteInput }, UpdateNoteOptimisticContext>({
        mutationFn: updateNote,
        
        // --- Temporarily Comment Out Optimistic Update Logic --- 
        /*
        onMutate: async (variables) => {
            const { noteId, input } = variables;
            // Only apply optimistic update for favorite toggling
            if (input.favorite === undefined) return;

            const generalNotesKey = getNotesQueryKey();
            const favoriteNotesKey = getNotesQueryKey({ favorite: true });
            const noteDetailKey = ['note', noteId];

            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: generalNotesKey });
            await queryClient.cancelQueries({ queryKey: favoriteNotesKey });
            await queryClient.cancelQueries({ queryKey: noteDetailKey });

            // Snapshot the previous values
            const previousNotes = queryClient.getQueryData<GetNotesResponse>(generalNotesKey);
            const previousFavoriteNotes = queryClient.getQueryData<GetNotesResponse>(favoriteNotesKey);
            const previousNoteDetail = queryClient.getQueryData<NoteDetail>(noteDetailKey);

            // ---> CORRECTED LOGIC FOR GENERAL NOTES LIST <--- 
            if (previousNotes) {
                queryClient.setQueryData<GetNotesResponse>(generalNotesKey, (old) => {
                    if (!old) return { notes: [], total: 0 };
                    // ONLY update the favorite flag, DO NOT filter
                    const updatedNotes = old.notes.map(note => 
                        note.id === noteId ? { ...note, favorite: input.favorite! } : note
                    );
                    return {
                        ...old,
                        notes: updatedNotes,
                    };
                });
            }
            // ---> END CORRECTION <--- 
            
            // Optimistically update the favorites list cache (This logic remains correct)
            if (previousFavoriteNotes) {
                queryClient.setQueryData<GetNotesResponse>(favoriteNotesKey, (old) => {
                    if (!old) return { notes: [], total: 0 };
                    
                    let newNotes: NoteListItem[];

                    if (input.favorite === true) {
                        // Favoriting: Add or update
                        const noteToAdd = previousNotes?.notes.find(n => n.id === noteId); 
                        if (old.notes.some(n => n.id === noteId)) {
                            newNotes = old.notes.map(note => 
                                note.id === noteId ? { ...note, favorite: true } : note
                            );
                        } else if (noteToAdd) {
                            newNotes = [...old.notes, { ...noteToAdd, favorite: true }]; 
                        } else {
                            console.warn(`[Optimistic Update] Note ID ${noteId} not found in general cache to add to favorites.`);
                            newNotes = old.notes;
                        }
                    } else {
                        // Unfavoriting: Remove from list
                        newNotes = old.notes.filter(note => note.id !== noteId);
                    }
                    
                    return {
                        ...old,
                        notes: newNotes,
                        total: newNotes.length // Adjust total count for favorites list
                    };
                });
            }

            // Optimistically update the note detail cache (This logic remains correct)
            if (previousNoteDetail) {
                queryClient.setQueryData<NoteDetail>(noteDetailKey, (old) => 
                    old ? { ...old, favorite: input.favorite! } : undefined
                );
            }

            // Return a context object with the snapshotted values
            return { previousNotes, previousNoteDetail, previousFavoriteNotes };
        },
        */
        
        // --- Temporarily Comment Out Optimistic Error Handler ---
        /*
        onError: (err, variables, context) => { 
            console.error("Optimistic update failed:", err);
            // Rollback to the previous values on error
            if (context?.previousNotes) {
                queryClient.setQueryData(getNotesQueryKey(), context.previousNotes);
            }
             if (context?.previousFavoriteNotes) {
                queryClient.setQueryData(getNotesQueryKey({ favorite: true }), context.previousFavoriteNotes);
            }
            if (context?.previousNoteDetail) {
                queryClient.setQueryData(['note', variables.noteId], context.previousNoteDetail);
            }
            toast.error(err.message || 'Failed to update favorite status.');
        },
        */
       
        // --- Keep onSettled and onSuccess --- 
        onSettled: (data, error, variables) => {
            const { noteId, input } = variables;
            const currentNoteData = queryClient.getQueryData<NoteDetail>(['note', noteId]);
            const sourceFolderId = currentNoteData?.folderId; 

            console.group(`%c[useUpdateNote onSettled] Invalidating for Note ID: ${noteId}`, 'color: orange; font-weight: bold;');

            // --- Standard Invalidations ---
            const noteDetailKey = ['note', noteId];
            console.log('Invalidating Note Detail:', noteDetailKey);
            queryClient.invalidateQueries({ queryKey: noteDetailKey });

            const generalNotesKey = getNotesQueryKey();
            console.log('Invalidating General Notes:', generalNotesKey);
            queryClient.invalidateQueries({ queryKey: generalNotesKey });
            
            const favoriteNotesKey = getNotesQueryKey({ favorite: true });
            console.log('Invalidating Favorite Notes:', favoriteNotesKey);
            queryClient.invalidateQueries({ queryKey: favoriteNotesKey });

            const foldersKey = ['folders'];
            console.log('Invalidating Folders:', foldersKey);
            queryClient.invalidateQueries({ queryKey: foldersKey });

            // --- Conditional Invalidations for Moving Notes ---
            if (input.folderId !== undefined) {
                console.log('Detected folder change...');
                const targetFolderId = input.folderId; 
                const targetFolderKey = getNotesQueryKey({ folderId: targetFolderId === null ? undefined : targetFolderId });
                console.log('Invalidating Target Folder List:', targetFolderKey);
                queryClient.invalidateQueries({ queryKey: targetFolderKey });

                if (sourceFolderId !== targetFolderId && sourceFolderId !== undefined) { 
                    const sourceFolderKey = getNotesQueryKey({ folderId: sourceFolderId === null ? undefined : sourceFolderId });
                    console.log('Invalidating Source Folder List:', sourceFolderKey);
                    queryClient.invalidateQueries({ queryKey: sourceFolderKey });
                }
            } else {
                console.log('No folder change detected.');
            }
            console.groupEnd();
        },
        onSuccess: (data, variables) => {
            toast.success(`Note "${data?.title ?? 'Note'}" updated successfully.`);
            console.log('Note updated successfully, ID:', variables.noteId);
        },
        // Add a basic generic onError if the optimistic one is removed
         onError: (error) => {
             toast.error(error.message || 'Failed to update note.');
             console.error('Note update failed:', error);
         }
    });
}

// --- Delete Note Mutation --- //

// API function to delete a note
const deleteNoteApi = async (noteId: number): Promise<void> => {
    try {
        // DELETE request, typically returns 204 No Content on success
        await apiClient.delete(`/notes/${noteId}`);
    } catch (error: any) {
        console.error(`Error deleting note ${noteId}:`, error);
        throw new AppError(
            error.response?.status || '500',
            error.response?.data?.message || 'Failed to delete note'
        );
    }
};

/**
 * TanStack Query hook to delete a note.
 */
export function useDeleteNote() {
    const queryClient = useQueryClient();

    return useMutation<void, AppError, number>({
        mutationFn: deleteNoteApi,
        onSuccess: (_, noteId) => {
            // Invalidate the notes list query to refresh the list
            queryClient.invalidateQueries({ queryKey: getNotesQueryKey() });
            // Optional: Remove the note from specific detail query cache if needed
            queryClient.removeQueries({ queryKey: ['note', noteId] });
            // Consider invalidating folder counts if applicable
            queryClient.invalidateQueries({ queryKey: ['folders'] });

            toast.success(`Note deleted successfully.`);
            console.log('Note deleted successfully, ID:', noteId);
        },
        onError: (error, noteId) => {
            toast.error(error.message || 'Failed to delete note.');
            console.error(`Note delete failed for ID ${noteId}:`, error);
        },
    });
} 