// NoteFolderMenu.tsx
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from "@/components/ui/button";
import { 
  Star, 
  Move, 
  MoreHorizontal, 
  Trash2,
  FolderKanban,
  FolderSync,
  Check,
  Loader2,
  FolderPlus,
  Folder
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MoveNoteDialog } from '@/components/notes/MoveNoteDialog';
import { useToast } from "@/hooks/use-toast"; // Ensure path is correct
import { cn } from '@/lib/utils';
// Import the specific modifier function needed
import { updateMockNoteFolder } from '@/lib/mockData';
import { useFolders, FolderWithCount } from '@/hooks/useFolderQueries'; // Import useFolders
import { useDeleteNote, useUpdateNote, NoteListItem as Note } from '@/hooks/useNotesQueries'; // Import the new hook
// import { Note } from '@/types'; // Assuming a shared Note type exists

// --- Type (Copied from NotesIndexPage for now - Define properly later) ---
type NoteSourceType = 'PDF' | 'YouTube' | 'Audio' | 'Image' | 'Text';
interface Folder {
  id: number;
  name: string;
}
// -------------------------------------------------------------------------

// --- Placeholder API Functions (REMOVE UNUSED) ---
// REMOVE placeholderDeleteNote and placeholderToggleFavorite if using real hooks
// const placeholderDeleteNote = async (noteId: number) => { ... };
// const placeholderToggleFavorite = async (noteId: number, isFavorite: boolean) => { ... };

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

  // Use the new hook for deleting notes
  const { mutate: deleteNoteMutate, isPending: isDeleting } = useDeleteNote();
  const { mutate: moveNoteMutate, isPending: isMoving } = useUpdateNote(); // Use the new hook for moving notes

  // State for confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // --- Remove Placeholder Mutations ---
  // const { mutate: deleteNoteMutate, isPending: isDeleting } = useMutation<void, Error, number>({ mutationFn: placeholderDeleteNote, ... });
  // const { mutate: toggleFavoriteMutate, isPending: isTogglingFavorite } = useMutation<Note, Error, { noteId: number; isFavorite: boolean }>({ mutationFn: (vars) => placeholderToggleFavorite(vars.noteId, vars.isFavorite), ... });
  // const moveNoteMutation = useMutation<Note, Error, { noteId: number; folderId: number | null }>( { mutationFn: async (vars) => { ... } ... });

  const confirmDelete = () => {
    deleteNoteMutate(note.id);
    setIsDeleteDialogOpen(false); // Close dialog after confirming
  };
  
  const handleMoveNote = (folderId: number | null) => {
    if (note.folderId === folderId) {
        setIsSubMenuOpen(false);
        setIsMenuOpen(false);
        return;
    }
    moveNoteMutate({ noteId: note.id, input: { folderId: folderId } }); // Use update hook format
    // Close menus optimistically or in onSuccess of the hook
    setIsSubMenuOpen(false);
    setIsMenuOpen(false);
  };

  return (
    <>
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
          
          <DropdownMenuSub open={isSubMenuOpen} onOpenChange={setIsSubMenuOpen}>
            <DropdownMenuSubTrigger disabled={isMoving || isLoadingFolders}>
              {isMoving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
              ) : (
                  <FolderPlus className="mr-2 h-4 w-4" />
              )}
              <span>Move to...</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>Select Folder</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isLoadingFolders ? (
                   <DropdownMenuItem disabled className="flex justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                   </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem 
                      onClick={() => handleMoveNote(null)} 
                      disabled={note.folderId === null || isMoving}
                      className={cn(note.folderId === null && "bg-accent/50")}
                    >
                      <Folder className="mr-2 h-4 w-4 opacity-50"/>
                      (No Folder)
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem 
                        key={folder.id} 
                        onClick={() => handleMoveNote(folder.id)} 
                        disabled={note.folderId === folder.id || isMoving}
                        className={cn(note.folderId === folder.id && "bg-accent/50")}
                      >
                        <Folder className="mr-2 h-4 w-4"/>
                        {folder.name}
                      </DropdownMenuItem>
                    ))}
                    {folders.length === 0 && (
                      <DropdownMenuItem disabled>
                        No folders created yet.
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            className="text-destructive focus:bg-destructive/10 focus:text-destructive" 
            onClick={() => setIsDeleteDialogOpen(true)}
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the note
              <span className="font-semibold"> "{note.title}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className={buttonVariants({ variant: "destructive" })} 
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 