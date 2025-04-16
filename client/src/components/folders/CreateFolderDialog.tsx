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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateFolder, CreateFolderInput } from '@/hooks/useFolderQueries';
import { toast } from 'sonner'; // Assuming use of sonner for toasts

interface CreateFolderDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    parentId?: number | null; // Optional parent folder ID for creating subfolders
}

export function CreateFolderDialog({ isOpen, onOpenChange, parentId = null }: CreateFolderDialogProps) {
    const [folderName, setFolderName] = useState('');
    const createFolderMutation = useCreateFolder();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!folderName.trim()) {
            toast.error('Folder name cannot be empty.');
            return;
        }

        const input: CreateFolderInput = {
            name: folderName.trim(),
            parentId: parentId, // Pass the parentId if creating a subfolder
        };

        createFolderMutation.mutate(input, {
            onSuccess: () => {
                toast.success(`Folder "${input.name}" created successfully!`);
                setFolderName(''); // Reset input
                onOpenChange(false); // Close dialog
            },
            onError: (error) => {
                toast.error(error.message || 'Failed to create folder.');
            },
        });
    };

    // Close dialog resets state
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setFolderName(''); 
            createFolderMutation.reset(); // Reset mutation state if dialog is closed manually
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{parentId ? 'Create New Subfolder' : 'Create New Folder'}</DialogTitle>
                    <DialogDescription>
                        Enter a name for your new folder. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="folder-name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="folder-name"
                                value={folderName}
                                onChange={(e) => setFolderName(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g., Physics Notes"
                                disabled={createFolderMutation.isPending}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createFolderMutation.isPending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!folderName.trim() || createFolderMutation.isPending}>
                            {createFolderMutation.isPending ? 'Saving...' : 'Save Folder'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 