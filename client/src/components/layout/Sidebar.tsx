import React, { useState } from 'react';
import { cn } from "@/lib/utils"; // Assuming a utility for className merging
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert
import {
    LayoutDashboard,
    StickyNote,
    Network,
    Layers3,
    CheckSquare,
    Folder as FolderIcon, // Alias the icon import
    Plus,
    ChevronDown,
    ChevronRight,
    Star,
    Settings,
    AlertCircle, // Icon for error
    Trash2, // Icon for delete
    Edit // Icon for rename (later)
} from "lucide-react";
import { useFolders, FolderWithCount, useDeleteFolder, useUpdateFolder, Folder } from '@/hooks/useFolderQueries'; // Import the hook and type
import { CreateFolderDialog } from '@/components/folders/CreateFolderDialog'; // Import the dialog
import { RenameFolderDialog } from '@/components/folders/RenameFolderDialog'; // Import Rename dialog
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'; // Import ConfirmationDialog
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"; // Import ContextMenu
import { Link, useLocation, useParams } from '@tanstack/react-router'; // Import Link and useLocation

interface NavItemProps {
    href: string;
    icon: React.ElementType;
    label: string;
    count?: number;
    isActive?: boolean;
    isSubItem?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ href, icon: Icon, label, count, isActive, isSubItem }) => (
    <Link
        to={href}
        className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            isSubItem && "pl-9"
        )}
    >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        {count !== undefined && (
            <span className={cn(
                "ml-auto rounded-full px-2 py-0.5 text-xs",
                isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
                {count}
            </span>
        )}
    </Link>
);

interface FolderItemProps {
    folder: FolderWithCount;
    level?: number;
    isActive?: boolean;
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, level = 0, isActive }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const deleteFolderMutation = useDeleteFolder();
    
    const ExpandIcon = isOpen ? ChevronDown : ChevronRight;
    const hasChildren = folder.children && folder.children.length > 0;

    const handleDelete = () => {
        setIsConfirmDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        deleteFolderMutation.mutate(folder.id);
    };
    
    const handleRename = () => {
        setIsRenameDialogOpen(true);
    };

    // Cast folder to Folder type for the dialog prop
    // Ensure it only includes properties defined in FolderType
    const folderForDialog: Folder | null = folder ? { 
        id: folder.id, 
        name: folder.name, 
        parentId: folder.parentId, 
    } : null;

    const handleContextMenuTriggerClick = (e: React.MouseEvent) => {
        // Allow context menu to open without navigating
        // e.preventDefault(); // Might not be needed if Link handles it
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div className="relative">
                    {/* Expand/Collapse button or spacer, absolutely positioned */}
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsOpen(!isOpen);
                            }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-4 w-4 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"
                            aria-label={isOpen ? "Collapse folder" : "Expand folder"}
                            tabIndex={-1}
                        >
                            <ExpandIcon className="h-4 w-4 flex-shrink-0" />
                        </button>
                    ) : (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0" />
                    )}
                    <Link
                        to="/folders/$folderId"
                        params={{ folderId: String(folder.id) }}
                        className={cn(
                            "flex items-center gap-3 rounded-md py-2 pr-3 pl-7 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            isActive && "bg-muted text-foreground"
                        )}
                    >
                        <FolderIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{folder.name}</span>
                        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground flex-shrink-0">
                            {folder.noteCount}
                        </span>
                    </Link>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                <ContextMenuItem onClick={handleRename}> 
                    <Edit className="mr-2 h-4 w-4" />
                    Rename
                </ContextMenuItem>
                <ContextMenuItem 
                    onClick={handleDelete} 
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    disabled={deleteFolderMutation.isPending}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Folder
                </ContextMenuItem>
            </ContextMenuContent>

            {/* Confirmation Dialog for Delete */}
            <ConfirmationDialog 
                isOpen={isConfirmDeleteDialogOpen}
                onOpenChange={setIsConfirmDeleteDialogOpen}
                onConfirm={confirmDelete}
                title="Delete Folder?"
                description={`Are you sure you want to delete the folder "${folder.name}"? Notes inside will not be deleted but will be moved out.`}
                confirmText="Delete"
            />

            {/* Rename Dialog */}
            <RenameFolderDialog 
                isOpen={isRenameDialogOpen}
                onOpenChange={setIsRenameDialogOpen}
                folder={folderForDialog} // Pass the current folder data
            />

            {/* Recursive children rendering */}
            {isOpen && hasChildren && (
                <div className="mt-1 space-y-1">
                    {folder.children.map((childFolder) => (
                        <FolderItem 
                            key={childFolder.id} 
                            folder={childFolder} 
                            level={level + 1} 
                            isActive={false}
                        />
                    ))}
                </div>
            )}
        </ContextMenu>
    );
};

// Recursive component to render the folder list
interface FolderListProps {
    folders: FolderWithCount[];
    activeFolderId?: number | null;
}

const FolderList: React.FC<FolderListProps> = ({ folders, activeFolderId }) => {
    if (!folders || folders.length === 0) {
        return <p className="px-4 text-sm text-muted-foreground">No folders yet.</p>;
    }
    return (
        <div className="space-y-1">
            {folders.map((folder) => (
                <FolderItem 
                    key={folder.id} 
                    folder={folder} 
                    isActive={folder.id === activeFolderId}
                />
            ))}
        </div>
    );
};

function Sidebar() {
    const location = useLocation();
    const params = useParams({ strict: false });
    const currentPathname = location.pathname;

    // Determine active state by comparing pathnames
    const isNotesActive = currentPathname === '/notes';
    const isNotesFavoritesActive = currentPathname === '/notes/favorites';
    const isDashboardActive = currentPathname === '/';
    const activeFolderId = params.folderId ? parseInt(params.folderId, 10) : null;
    // Add other routes as needed...

    const { data: folders, isLoading, error, isError } = useFolders();
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false); // State for dialog

    // --- Placeholder Data --- 
    // TODO: Replace with actual counts from API or calculations
    const allNotesCount = 12;
    const mindMapsCount = 3;
    const flashcardsCount = 5;
    const quizzesCount = 2;
    // --- End Placeholder --- 

    return (
        <>
            <aside className="hidden md:flex h-full w-64 flex-col border-r border-border bg-muted/40">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    {/* Optional: Add Logo or Title here if different from Header */}
                    <span className="font-semibold">Navigation</span>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
                        {/* Main Navigation - Use TanStack Link and active state */}
                        <NavItem href="/" icon={LayoutDashboard} label="Dashboard" isActive={isDashboardActive} />
                        <NavItem href="/notes" icon={StickyNote} label="All Notes" count={allNotesCount} isActive={isNotesActive} /> 
                        <NavItem href="/mind-maps" icon={Network} label="Mind Maps" count={mindMapsCount} /> {/* Add isActive later */}
                        <NavItem href="/flashcards" icon={Layers3} label="Flashcards" count={flashcardsCount} /> {/* Add isActive later */}
                        <NavItem href="/quizzes" icon={CheckSquare} label="Quizzes" count={quizzesCount} /> {/* Add isActive later */}

                        {/* Folders Section */}
                        <div className="pt-4">
                            <div className="flex items-center justify-between px-3 py-2">
                                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Folders</h3>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6" 
                                    onClick={() => setIsCreateFolderOpen(true)}
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="sr-only">New Folder</span>
                                </Button>
                            </div>
                            <div className="px-2 lg:px-4 mt-2">
                                {isLoading && (
                                    <div className="space-y-2">
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full opacity-75" />
                                    </div>
                                )}
                                {isError && error && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>
                                            {error.message || 'Could not load folders.'}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {!isLoading && !isError && folders && 
                                    <FolderList 
                                        folders={folders} 
                                        activeFolderId={activeFolderId}
                                    />
                                }
                            </div>
                        </div>

                         {/* Favorites Section */}
                        <div className="pt-4">
                            <NavItem href="/notes/favorites" icon={Star} label="Favorites" isActive={isNotesFavoritesActive} />
                        </div>

                        {/* Settings Footer */}
                        <div className="mt-auto pt-4"> 
                            {/* <NavItem href="/settings" icon={Settings} label="Settings" /> */}
                        </div>
                    </nav>
                </div>
            </aside>
            <CreateFolderDialog isOpen={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen} />
        </>
    );
}

export default Sidebar; 