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
    Folder,
    Plus,
    ChevronDown,
    ChevronRight,
    Star,
    Settings,
    AlertCircle // Icon for error
} from "lucide-react";
import { useFolders, FolderWithCount } from '@/hooks/useFolderQueries'; // Import the hook and type
import { CreateFolderDialog } from '@/components/folders/CreateFolderDialog'; // Import the dialog

interface NavItemProps {
    href: string;
    icon: React.ElementType;
    label: string;
    count?: number;
    isActive?: boolean;
    isSubItem?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ href, icon: Icon, label, count, isActive, isSubItem }) => (
    <a
        href={href} // Replace with router Link component later
        className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
                ? "bg-primary/10 text-primary" // Active state style
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            isSubItem && "pl-9" // Indent sub-items
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
    </a>
);

interface FolderItemProps {
    folder: FolderWithCount; // Use the fetched folder data type
    level?: number; // To handle indentation for nesting
    isActive?: boolean; // TODO: Determine active folder based on route/params
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, level = 0, isActive }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const Icon = isOpen ? ChevronDown : ChevronRight;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
        <div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={!hasChildren} // Disable toggle if no children
                style={{ paddingLeft: `${0.75 + level * 1.25}rem` }} // Dynamic indentation (adjust multiplier as needed)
                className={cn(
                    "flex w-full items-center gap-2 rounded-md py-2 pr-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
                    isActive && "bg-muted text-foreground", // Active state
                    !hasChildren && "cursor-default hover:bg-transparent" // Style for non-expandable items
                )}
            >
                {hasChildren ? (
                    <Icon className="h-4 w-4 flex-shrink-0" />
                ) : (
                    <span className="w-4 h-4 flex-shrink-0"></span> // Placeholder for alignment
                )}
                <Folder className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-grow text-left">{folder.name}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground flex-shrink-0">
                    {folder.noteCount}
                </span>
                {/* Add Context Menu Trigger here later */}
            </button>
            {/* Render children recursively */}
            {isOpen && hasChildren && (
                <div className="mt-1 space-y-1">
                    {folder.children.map((childFolder) => (
                        <FolderItem 
                            key={childFolder.id} 
                            folder={childFolder} 
                            level={level + 1} 
                            isActive={false} // Pass active state down if needed
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Recursive component to render the folder list
interface FolderListProps {
    folders: FolderWithCount[];
}

const FolderList: React.FC<FolderListProps> = ({ folders }) => {
    if (!folders || folders.length === 0) {
        return <p className="px-4 text-sm text-muted-foreground">No folders yet.</p>;
    }
    return (
        <div className="space-y-1">
            {folders.map((folder) => (
                <FolderItem key={folder.id} folder={folder} isActive={false} />
            ))}
        </div>
    );
};

function Sidebar() {
    const currentPath = "/dashboard"; // Placeholder
    const { data: folders, isLoading, error, isError } = useFolders();
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false); // State for dialog

    return (
        <>
            <aside className="hidden md:flex h-full w-64 flex-col border-r border-border bg-muted/40">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    {/* Optional: Add Logo or Title here if different from Header */}
                    <span className="font-semibold">Navigation</span>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
                        {/* Main Navigation */}
                        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" isActive={currentPath === '/dashboard'} />
                        <NavItem href="/notes" icon={StickyNote} label="All Notes" count={12} isActive={currentPath === '/notes'} />
                        <NavItem href="/mind-maps" icon={Network} label="Mind Maps" count={3} isActive={currentPath === '/mind-maps'} />
                        <NavItem href="/flashcards" icon={Layers3} label="Flashcards" count={5} isActive={currentPath === '/flashcards'} />
                        <NavItem href="/quizzes" icon={CheckSquare} label="Quizzes" count={2} isActive={currentPath === '/quizzes'} />

                        {/* Folders Section */}
                        <div className="pt-4">
                            <div className="flex items-center justify-between px-3 py-2">
                                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Folders</h3>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6" 
                                    onClick={() => setIsCreateFolderOpen(true)} // Set state to true
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
                                {!isLoading && !isError && folders && (
                                    <FolderList folders={folders} />
                                )}
                            </div>
                        </div>
                    </nav>
                </div>
                {/* Optional Bottom Section (Favorites, Settings) */}
                <div className="mt-auto border-t p-4">
                     <nav className="space-y-1">
                        <NavItem href="/favorites" icon={Star} label="Favorites" isActive={currentPath === '/favorites'} />
                        <NavItem href="/settings" icon={Settings} label="Settings" isActive={currentPath === '/settings'} />
                    </nav>
                </div>
            </aside>

            {/* Render the Dialog component outside the aside */}
            <CreateFolderDialog 
                isOpen={isCreateFolderOpen} 
                onOpenChange={setIsCreateFolderOpen} 
            />
        </>
    );
}

export default Sidebar; 