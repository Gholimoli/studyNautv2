import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client'; // Correct the import path and name for the Axios instance
import { AppError } from '@/types/errors'; // Update the import path for AppError

// Mirror the backend FolderWithCount interface
export interface FolderWithCount {
    id: number;
    parentId: number | null;
    name: string;
    createdAt: string;
    updatedAt: string;
    noteCount: number;
    children: FolderWithCount[];
}

// Type for the API response
interface FoldersApiResponse {
    folders: FolderWithCount[];
}

// Type for the API response when creating a folder (matches backend)
export type Folder = Omit<FolderWithCount, 'noteCount' | 'children'>;

// Type for the input to the createFolder mutation
export interface CreateFolderInput {
    name: string;
    parentId?: number | null;
}

/**
 * Fetches all folders for the authenticated user from the API.
 * Includes note counts and hierarchical structure.
 */
const fetchFolders = async (): Promise<FolderWithCount[]> => {
    try {
        const response = await apiClient.get<FoldersApiResponse>('/folders');
        // The backend directly returns { folders: [...] }
        return response.data.folders; 
    } catch (error: any) {
        // Consider more specific error handling based on your Axios setup
        console.error("Error fetching folders:", error);
        throw new AppError(
            error.response?.status || '500', 
            error.response?.data?.message || 'Failed to fetch folders'
        );
    }
};

/**
 * TanStack Query hook to fetch and cache user folders.
 */
export function useFolders() {
    return useQuery<FolderWithCount[], AppError>({
        queryKey: ['folders'], // Unique key for this query
        queryFn: fetchFolders,
        // Optional: Add staleTime, gcTime, refetch configurations as needed
        // staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

// --- Mutations --- 

/**
 * API function to create a new folder.
 */
const createFolder = async (input: CreateFolderInput): Promise<Folder> => {
    try {
        const response = await apiClient.post<Folder>('/folders', input);
        return response.data;
    } catch (error: any) {
        console.error("Error creating folder:", error);
        throw new AppError(
            error.response?.status || '500',
            error.response?.data?.message || 'Failed to create folder'
        );
    }
};

/**
 * TanStack Query hook to create a new folder.
 */
export function useCreateFolder() {
    const queryClient = useQueryClient();

    return useMutation<Folder, AppError, CreateFolderInput>({
        mutationFn: createFolder,
        onSuccess: (data) => {
            // Invalidate the folders query to refetch the list
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            
            // Optional: Add the new folder directly to the cache for immediate UI update
            // queryClient.setQueryData(['folders'], (oldData: FolderWithCount[] | undefined) => { ... });
            
            // Optional: Show a success toast
            console.log('Folder created successfully:', data);
        },
        onError: (error) => {
            // Optional: Show an error toast
            console.error('Folder creation failed:', error);
        },
    });
}

// --- Mutations will be added later --- 