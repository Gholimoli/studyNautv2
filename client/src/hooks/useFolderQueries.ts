import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AppError } from '@shared/types/errors';
import { toast } from 'sonner';

// --- Types ---

// Represents a folder, possibly with nested structure
export interface Folder {
  id: number;
  name: string;
  parentId?: number | null;
  children?: Folder[]; 
}

// Represents a folder including the count of notes within it
export interface FolderWithCount extends Folder {
  noteCount: number;
  children: FolderWithCount[]; // Ensure children also have counts
}

// Input type for creating a folder
export interface CreateFolderInput {
  name: string;
  parentId?: number | null;
}

// Type for the input to the updateFolder mutation
export interface UpdateFolderInput {
    name?: string;      // Optional: Only include fields that can be updated
    parentId?: number | null; // Optional: For moving folders later
}

// --- API Functions (Using apiClient) ---

/**
 * Fetches all folders for the authenticated user.
 * REAL IMPLEMENTATION: Calls the API endpoint.
 */
const fetchFolders = async (): Promise<FolderWithCount[]> => {
  try {
    console.log("[fetchFolders REAL] Fetching folders from API...");
    // Expect response to be { folders: FolderWithCount[] }
    const response = await apiClient.get<{ folders: FolderWithCount[] }>('/folders'); 
    console.log("[fetchFolders REAL] Received response data:", response.data);
    // Return the nested folders array, or an empty array if it's missing
    return response.data.folders || []; 
  } catch (error: any) {
    console.error("Error fetching folders:", error);
    throw new AppError(
      error.response?.status || 500,
      error.response?.data?.message || "Failed to fetch folders."
    );
  }
};

/**
 * API function to create a new folder.
 * REAL IMPLEMENTATION: Calls the API endpoint.
 */
const createFolder = async (input: CreateFolderInput): Promise<Folder> => {
  try {
    console.log("[createFolder REAL] Sending folder data to API:", input);
    const response = await apiClient.post<Folder>('/folders', input);
    console.log("[createFolder REAL] Folder created:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error creating folder:", error);
    throw new AppError(
      error.response?.status || 500,
      error.response?.data?.message || "Failed to create folder."
    );
  }
};

/**
 * API function to delete a folder.
 * REAL IMPLEMENTATION: Calls the API endpoint.
 */
const deleteFolder = async (folderId: number): Promise<void> => {
  try {
    console.log(`[deleteFolder REAL] Deleting folder ID: ${folderId}`);
    await apiClient.delete(`/folders/${folderId}`);
    console.log(`[deleteFolder REAL] Folder ${folderId} deleted successfully.`);
    // No return value needed for DELETE success typically (204 No Content)
  } catch (error: any) {
    console.error(`Error deleting folder ${folderId}:`, error);
    throw new AppError(
      error.response?.status || 500,
      error.response?.data?.message || "Failed to delete folder."
    );
  }
};

// --- TanStack Query Hooks ---

/**
 * Hook to fetch folders.
 */
export function useFolders() {
  return useQuery<FolderWithCount[], AppError>({ 
    queryKey: ['folders'], 
    queryFn: fetchFolders,
    // Consider adding staleTime if folder list doesn't change often
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a folder.
 */
export function useCreateFolder() {
    const queryClient = useQueryClient();
    return useMutation<Folder, AppError, CreateFolderInput>({
        mutationFn: createFolder,
        onSuccess: (data) => {
            // Invalidate the folders query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            console.log('Folder created successfully via API:', data);
            // Consider adding a success toast if needed
        },
        onError: (error) => {
            console.error('Folder creation failed via API:', error);
            // Consider adding an error toast
        },
    });
}

/**
 * Hook to delete a folder.
 */
export function useDeleteFolder() {
    const queryClient = useQueryClient();
    // The mutation expects folderId (number) and returns void on success
    return useMutation<void, AppError, number>({ 
        mutationFn: deleteFolder, 
        onSuccess: (_, folderId) => { // First argument is the result (void), second is the variable (folderId)
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            // Also invalidate notes queries as notes might become unassigned
            queryClient.invalidateQueries({ queryKey: ['notes'] }); 
            console.log(`Folder ${folderId} deleted successfully via API.`);
            // Optional: toast.success()
        },
        onError: (error, folderId) => {
            console.error(`Folder deletion failed for ID ${folderId} via API:`, error);
             // Optional: toast.error()
        },
    });
}

// --- Mutations will be added later --- 