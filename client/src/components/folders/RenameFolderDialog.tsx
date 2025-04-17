import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateFolder, UpdateFolderInput, Folder } from '@/hooks/useFolderQueries';
import { toast } from 'sonner';

interface RenameFolderDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    folder: Folder | null; // Pass the folder being renamed
}

export function RenameFolderDialog({ isOpen, onOpenChange, folder }: RenameFolderDialogProps) {
    const [folderName, setFolderName] = useState('');
    const updateFolderMutation = useUpdateFolder();

    // Pre-fill the input when the dialog opens with a folder
    useEffect(() => {
        if (folder && isOpen) {
            setFolderName(folder.name);
        } 
        // Reset when closing or folder changes while closed
        if (!isOpen) {
             setFolderName('');
        }
    }, [folder, isOpen]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!folderName.trim()) {
            toast.error('Folder name cannot be empty.');
            return;
        }
        if (!folder) {
            toast.error('No folder selected for renaming.');
            return;
        }
        // Only submit if name changed
        if (folderName.trim() === folder.name) {
             onOpenChange(false); // Close dialog without action
             return;
        }

        const input: UpdateFolderInput = {
            name: folderName.trim(),
            // parentId is not handled in this dialog
        };

        updateFolderMutation.mutate({ folderId: folder.id, input }, {
            onSuccess: () => {
                // Success toast handled by the hook, just close dialog
                onOpenChange(false);
            },
            onError: (error) => {
                 // Error toast handled by the hook
                console.error("Rename failed from dialog");
            },
        });
    };

    // Close dialog resets state
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            // Reset name input only if closing manually, not on success submit
            // The useEffect handles resetting if folder changes while closed
            updateFolderMutation.reset(); 
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Rename Folder</DialogTitle>
                    <DialogDescription>
                        Enter a new name for the folder "{folder?.name || ''}".
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="folder-name-rename" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="folder-name-rename"
                                value={folderName}
                                onChange={(e) => setFolderName(e.target.value)}
                                className="col-span-3"
                                placeholder="Enter new folder name"
                                disabled={updateFolderMutation.isPending || !folder}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={updateFolderMutation.isPending}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={!folderName.trim() || updateFolderMutation.isPending || !folder || folderName.trim() === folder?.name}
                        >
                            {updateFolderMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 