import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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