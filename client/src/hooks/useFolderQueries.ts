import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client'; // Correct the import path and name for the Axios instance
import { AppError } from '@/types/errors'; // Update the import path for AppError
import { toast } from 'sonner'; // Assuming use of sonner for toasts
// Import the shared mock data and types AND the modifier functions
import { 
    mockFoldersData, 
    FolderType, 
    mockNotesData, 
    addMockFolder, 
    deleteMockFolder, 
    updateMockFolder 
} from '@/lib/mockData';

// Mirror the backend FolderWithCount interface
// Ensure this matches the structure returned by the *real* API later
export interface FolderWithCount {
    id: number;
    parentId: number | null; // Type is correct here
    name: string;
    createdAt?: string; 
    updatedAt?: string; 
    noteCount: number; 
    children: FolderWithCount[];
}

// Use FolderType imported from mockData
export type Folder = FolderType;

// Type for the API response (less relevant when using mock data directly)
// interface FoldersApiResponse { ... }

// Type for the input to the createFolder mutation
export interface CreateFolderInput {
    name: string;
    parentId?: number | null;
}

// Type for the input to the updateFolder mutation
export interface UpdateFolderInput {
    name?: string;      // Optional: Only include fields that can be updated
    parentId?: number | null; // Optional: For moving folders later
}

/**
 * Fetches all folders for the authenticated user.
 * MOCK IMPLEMENTATION: Returns shared mock data and calculates counts.
 */
const fetchFolders = async (): Promise<FolderWithCount[]> => {
    console.log("[fetchFolders MOCK] Calculating counts...");
    // Import mock data *inside* function scope as a potential workaround for HMR issues
    const { mockFoldersData: currentFolders, mockNotesData: currentNotes } = await import('@/lib/mockData');
    
    console.log("[fetchFolders MOCK] Current mockFoldersData:", JSON.stringify(currentFolders));
    console.log("[fetchFolders MOCK] Current mockNotesData:", JSON.stringify(currentNotes));
    await new Promise(r => setTimeout(r, 150)); 

    // Calculate counts accurately based on currentNotes
    const notesInFolder = (folderId: number | null): number => {
        if (folderId === null) return 0; 
        return currentNotes.filter(note => note.folderId === folderId).length;
    }

    // Transform currentFolders into FolderWithCount structure
    const transformedFolders: FolderWithCount[] = currentFolders.map(folder => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId ?? null, 
        noteCount: notesInFolder(folder.id), // Use the calculated count
        children: [], 
    }));
    
    console.log("[fetchFolders MOCK] Returning transformed folders:", JSON.stringify(transformedFolders));
    return transformedFolders;
};

/**
 * TanStack Query hook to fetch and cache user folders.
 */
export function useFolders() {
    return useQuery<FolderWithCount[], AppError>({
        queryKey: ['folders'], 
        queryFn: fetchFolders,
    });
}

// --- Mutations --- 

/**
 * API function to create a new folder.
 * MOCK: Calls addMockFolder to update localStorage
 */
const createFolder = async (input: CreateFolderInput): Promise<Folder> => {
    console.log("MOCK createFolder: Attempting to add folder:", input);
    const newId = Date.now(); 
    const newFolder: Folder = { ...input, id: newId, parentId: input.parentId ?? null }; 
    addMockFolder(newFolder); // Call the localStorage-updating function
    await new Promise(r => setTimeout(r, 150)); 
    return newFolder;
};

export function useCreateFolder() {
    const queryClient = useQueryClient();
    return useMutation<Folder, AppError, CreateFolderInput>({
        mutationFn: createFolder,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            console.log('Mock Folder created successfully:', data);
        },
        onError: (error) => {
            console.error('Mock Folder creation failed:', error);
        },
    });
}

/**
 * API function to delete a folder.
 * MOCK: Calls deleteMockFolder to update localStorage
 */
const deleteFolder = async (folderId: number): Promise<{ deletedId: number }> => {
    console.warn(`MOCK deleteFolder ID ${folderId}`);
    deleteMockFolder(folderId); // Call the localStorage-updating function
    await new Promise(r => setTimeout(r, 150));
    return { deletedId: folderId }; 
};

export function useDeleteFolder() {
    const queryClient = useQueryClient();
    // Ensure mutation hook type matches API function return type
    return useMutation< { deletedId: number }, AppError, number >({
        mutationFn: deleteFolder, 
        onSuccess: (data, folderId) => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            toast.success(`Mock Folder deleted successfully.`);
            console.log('Mock Folder deleted successfully, ID:', folderId);
        },
        onError: (error, folderId) => {
            toast.error(error.message || 'Failed to delete folder.');
            console.error(`Mock Folder deletion failed for ID ${folderId}:`, error);
        },
    });
}

/**
 * API function to update a folder (rename, move).
 * MOCK: Calls updateMockFolder to update localStorage
 */
const updateFolder = async ({ folderId, input }: { folderId: number; input: UpdateFolderInput }): Promise<Folder> => {
    console.warn(`MOCK updateFolder ID ${folderId}:`, input);
    // Prepare the update data, only include fields that are present in input
    const updateData: Partial<FolderType> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.parentId !== undefined) updateData.parentId = input.parentId; // Allows moving
    
    updateMockFolder(folderId, updateData); // Call the localStorage-updating function
    
    // Find the updated folder to return (needed for promise type)
    // NOTE: This reads the *already updated* mockFoldersData
    const updatedFolder = mockFoldersData.find(f => f.id === folderId);

    if (!updatedFolder) {
        throw new Error(`Mock update failed: Folder ${folderId} not found after update.`);
    }
    
    await new Promise(r => setTimeout(r, 150));
    return updatedFolder;
};

export function useUpdateFolder() {
    const queryClient = useQueryClient();
    return useMutation<Folder, AppError, { folderId: number; input: UpdateFolderInput }>({
        mutationFn: updateFolder,
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            toast.success(`Mock Folder "${data.name}" updated successfully.`);
            console.log('Mock Folder updated successfully, ID:', variables.folderId);
        },
        onError: (error, variables) => {
            toast.error(error.message || 'Failed to update folder.');
            console.error(`Mock Folder update failed for ID ${variables.folderId}:`, error);
        },
    });
}

// --- Mutations will be added later --- 