import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFolders, FolderWithCount } from '@/hooks/useFolderQueries';
import { useUpdateNote, UpdateNoteInput } from '@/hooks/useNotesQueries';
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Folder as FolderIcon } from "lucide-react";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MoveNoteDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    noteId: number | null;
    currentFolderId?: number | null; // Optional: to show current location
}

// Helper component to render folder options recursively
const FolderOption: React.FC<{ folder: FolderWithCount; level: number }> = ({ folder, level }) => {
    return (
        <div className="ml-4 pl-2 border-l border-muted">
            <div key={folder.id} className="flex items-center space-x-2 py-1.5">
                <RadioGroupItem value={folder.id.toString()} id={`folder-${folder.id}`} />
                <Label htmlFor={`folder-${folder.id}`} className="flex items-center gap-2 cursor-pointer">
                    <FolderIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{folder.name}</span>
                    <span className="text-xs text-muted-foreground">({folder.noteCount})</span>
                </Label>
            </div>
            {folder.children && folder.children.length > 0 && (
                 <div className="mt-1">
                    {folder.children.map(child => (
                        <FolderOption key={child.id} folder={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

export function MoveNoteDialog({ 
    isOpen, 
    onOpenChange, 
    noteId, 
    currentFolderId 
}: MoveNoteDialogProps) {
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const { data: folders, isLoading: isLoadingFolders, isError: isErrorFolders } = useFolders();
    const updateNoteMutation = useUpdateNote();

    // Set initial selection when dialog opens
    React.useEffect(() => {
        if (isOpen) {
            setSelectedFolderId(currentFolderId ? currentFolderId.toString() : 'root');
        }
    }, [isOpen, currentFolderId]);

    const handleSubmit = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!noteId) {
            toast.error("Cannot move note: Note ID is missing.");
            return;
        }
        if (selectedFolderId === null) {
            toast.error("Please select a destination folder.");
            return;
        }

        const targetFolderId = selectedFolderId === 'root' ? null : parseInt(selectedFolderId, 10);

        // Avoid mutation if destination is same as current
        if (targetFolderId === currentFolderId) {
            onOpenChange(false);
            return;
        }

        const input: UpdateNoteInput = {
            folderId: targetFolderId,
        };

        updateNoteMutation.mutate({ noteId, input }, {
            onSuccess: () => {
                // Toast handled by hook
                onOpenChange(false); // Close dialog
            },
            onError: (error) => {
                // Toast handled by hook
                console.error("Move note failed from dialog");
            }
        });
    };

     const handleCancelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleOpenChange(false);
     };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            // Reset selection only if closing manually
            setSelectedFolderId(currentFolderId ? currentFolderId.toString() : 'root');
            updateNoteMutation.reset();
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Move Note</DialogTitle>
                    <DialogDescription>
                        Select the folder where you want to move this note.
                    </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[50vh] my-4 pr-4">
                    {isLoadingFolders && (
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    )}
                    {isErrorFolders && (
                        <p className="text-sm text-destructive">Error loading folders.</p>
                    )}
                    {!isLoadingFolders && !isErrorFolders && (
                        <RadioGroup 
                            value={selectedFolderId ?? undefined} 
                            onValueChange={setSelectedFolderId}
                            className="space-y-1"
                        >
                            {/* Root Folder Option */}
                            <div className="flex items-center space-x-2 py-1.5">
                                <RadioGroupItem value="root" id="folder-root" />
                                <Label htmlFor="folder-root" className="cursor-pointer">Move to Root (No Folder)</Label>
                            </div>
                            {/* Render folder tree */}
                            {folders?.map(folder => (
                                <FolderOption key={folder.id} folder={folder} level={0} />
                            ))}
                             {folders?.length === 0 && (
                                <p className="text-sm text-muted-foreground py-2">No folders created yet.</p>
                            )}
                        </RadioGroup>
                    )}
                 </ScrollArea>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCancelClick} disabled={updateNoteMutation.isPending}>
                        Cancel
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleSubmit} 
                        disabled={selectedFolderId === null || updateNoteMutation.isPending || selectedFolderId === (currentFolderId ? currentFolderId.toString() : 'root')}
                    >
                        {updateNoteMutation.isPending ? 'Moving...' : 'Move Note'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 