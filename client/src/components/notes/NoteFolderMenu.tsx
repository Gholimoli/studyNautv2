// NoteFolderMenu.tsx
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { 
  Star, 
  Move, 
  MoreHorizontal, 
  Trash2,
  FolderKanban,
  FolderSync,
  Check,
  Loader2
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoveNoteDialog } from '@/components/notes/MoveNoteDialog';
import { useToast } from "@/hooks/use-toast"; // Ensure path is correct
import { cn } from '@/lib/utils';
// Import the specific modifier function needed
import { updateMockNoteFolder } from '@/lib/mockData';
import { useFolders, FolderWithCount } from '@/hooks/useFolderQueries'; // Import useFolders
// import { Note } from '@/types'; // Assuming a shared Note type exists

// --- Type (Copied from NotesIndexPage for now - Define properly later) ---
type NoteSourceType = 'PDF' | 'YouTube' | 'Audio' | 'Image' | 'Text';
interface Note {
  id: number;
  title: string;
  summary?: string;
  content?: string; 
  sourceType: NoteSourceType;
  createdAt: string | Date;
  folderId?: number | null;
  isFavorite?: boolean;
  tags?: { id: number; name: string }[];
  languageCode?: string;
}

interface Folder {
  id: number;
  name: string;
}
// -------------------------------------------------------------------------

// --- Placeholder API Functions (Needs Real Implementation) ---
// These should ideally call mutation hooks defined elsewhere
const placeholderDeleteNote = async (noteId: number) => { 
    console.warn(`API Delete for ${noteId} needs implementation`); 
    await new Promise(r => setTimeout(r, 300)); 
};
const placeholderToggleFavorite = async (noteId: number, currentStatus: boolean) => { 
    console.warn(`API Favorite toggle for ${noteId} needs implementation`); 
    await new Promise(r => setTimeout(r, 300)); 
    // Simulate returning updated note data
    return { id: noteId, title: 'Updated Note', isFavorite: !currentStatus } as unknown as Note;
};
// -------------------------------------------------------------------------

interface NoteFolderMenuProps {
  note: Note;
  // Remove stopPropagation prop if handled internally or via portals
}

export function NoteFolderMenu({ note }: NoteFolderMenuProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

  // Use the SHARED hook to get folders, consistent with Sidebar
  const { data: foldersData, isLoading: isLoadingFolders } = useFolders();

  // Extract the flat list of folders if needed (useFolders returns hierarchical)
  // For now, assume we only need top-level for the menu
  // TODO: Handle hierarchy if needed later
  const folders = foldersData || []; 

  // --- Mutations (Using placeholders for now - Replace with real hooks) ---
  const { mutate: deleteNoteMutate, isPending: isDeleting } = useMutation<void, Error, number>({
      mutationFn: placeholderDeleteNote,
      onSuccess: (_, noteId) => {
          toast({ title: "Note Deleted", description: `Note ${noteId} was deleted.` });
          queryClient.invalidateQueries({ queryKey: ['notes'] });
      },
      onError: (error, noteId) => {
          toast({ title: "Error", description: `Failed to delete note ${noteId}: ${error.message}`, variant: "destructive" });
      }
  });
  
   const { mutate: toggleFavoriteMutate, isPending: isTogglingFavorite } = useMutation<Note, Error, { noteId: number; isFavorite: boolean }>({
    mutationFn: (vars) => placeholderToggleFavorite(vars.noteId, vars.isFavorite),
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.setQueryData(['note', updatedNote.id], updatedNote); // Update detail cache
      toast({ title: "Favorite status updated!" });
      setIsMenuOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error updating favorite", description: error.message, variant: "destructive" });
    }
  });

  const moveNoteMutation = useMutation<Note, Error, { noteId: number; folderId: number | null }>({
    // Call the localStorage-updating function
    mutationFn: async (vars) => {
      console.log(`MOCK moveNote: Moving Note ${vars.noteId} to Folder ${vars.folderId}`);
      updateMockNoteFolder(vars.noteId, vars.folderId); // Update persisted mock data
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
      
      // Need to find the updated note to return the correct Note object type
      // Note: This reads the *already updated* mockNotesData from memory/localStorage scope
      const { mockNotesData: currentNotes } = await import('@/lib/mockData'); // Re-import to be sure
      const updatedNote = currentNotes.find(n => n.id === vars.noteId);

      if (!updatedNote) {
         console.error(`MOCK moveNote: Note ID ${vars.noteId} not found after update!`);
         throw new Error("Note not found after update");
      }
      return updatedNote; 
    },
    onSuccess: (updatedNote, variables) => {
      const { noteId, folderId: targetFolderId } = variables;
      const sourceFolderId = note.folderId; // Folder the note was previously in

      // Optimistically update the folder counts in the cache
      queryClient.setQueryData<FolderWithCount[]>(['folders'], (oldData) => {
        if (!oldData) return [];

        return oldData.map(folder => {
          let newCount = folder.noteCount;
          // Decrement count of the source folder (if it exists and wasn't null)
          if (sourceFolderId !== null && folder.id === sourceFolderId) {
            newCount = Math.max(0, newCount - 1); // Prevent negative counts
          }
          // Increment count of the target folder (if it exists and isn't null)
          if (targetFolderId !== null && folder.id === targetFolderId) {
            newCount = newCount + 1;
          }
          // Return folder with potentially updated count
          return { ...folder, noteCount: newCount };
        });
      });

      // Invalidate queries to refetch in the background for consistency
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] }); 
      
      toast({
        title: "Note Moved",
        description: `Note "${note.title}" moved successfully.`, 
      });
      setIsMenuOpen(false);
      setIsSubMenuOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to move note: ${error.message}`, variant: "destructive" });
    },
  });

  const confirmDelete = () => {
    deleteNoteMutate(note.id);
  };
  
  const handleToggleFavorite = (e: React.MouseEvent) => {
      e.preventDefault();
      toggleFavoriteMutate({ noteId: note.id, isFavorite: !!note.isFavorite });
  };
  
  const handleMoveNote = (folderId: number | null) => {
    if (note.folderId === folderId) {
        setIsSubMenuOpen(false);
        setIsMenuOpen(false);
        return;
    }
    moveNoteMutation.mutate({ noteId: note.id, folderId });
  };

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Note Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Note Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleToggleFavorite} disabled={isTogglingFavorite}>
          {isTogglingFavorite ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Star className={cn("mr-2 h-4 w-4", note.isFavorite && "fill-amber-400 text-amber-500")} />
          )}
          <span>{note.isFavorite ? "Unfavorite" : "Favorite"}</span>
        </DropdownMenuItem>
        
        <DropdownMenuSub open={isSubMenuOpen} onOpenChange={setIsSubMenuOpen}>
          <DropdownMenuSubTrigger disabled={moveNoteMutation.isPending}>
            {moveNoteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <FolderSync className="mr-2 h-4 w-4" />
            )}
            <span>Move to folder...</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuLabel>Select Folder</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoadingFolders ? (
                 <DropdownMenuItem disabled className="flex justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                 </DropdownMenuItem>
              ) : folders && folders.length > 0 ? (
                folders.map((folder) => (
                  <DropdownMenuItem 
                    key={folder.id} 
                    onClick={() => handleMoveNote(folder.id)} 
                    disabled={note.folderId === folder.id}
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    <span>{folder.name}</span>
                    {note.folderId === folder.id && <Check className="ml-auto h-4 w-4 text-primary" />} 
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No folders found.</DropdownMenuItem>
              )}
              {note.folderId && (
                 <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleMoveNote(null)}>
                        <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Move out of folder</span>
                    </DropdownMenuItem>
                 </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={confirmDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          <span>Delete Note</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 