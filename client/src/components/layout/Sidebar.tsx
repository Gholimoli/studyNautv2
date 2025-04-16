import React from 'react';
import { cn } from "@/lib/utils"; // Assuming a utility for className merging
import { Button } from "@/components/ui/button";
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
    Settings // Example icons
} from "lucide-react";

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
    label: string;
    count: number;
    isActive?: boolean;
    // Add state for expansion later
}

const FolderItem: React.FC<FolderItemProps> = ({ label, count, isActive }) => {
    // Basic implementation - Needs state for expansion
    const [isOpen, setIsOpen] = React.useState(false); // Example state
    const Icon = isOpen ? ChevronDown : ChevronRight;

    return (
        <div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
                     isActive && "bg-muted text-foreground" // Indicate active folder section
                )}
            >
                <Icon className="h-4 w-4" />
                <Folder className="h-4 w-4 mr-1" />
                <span>{label}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {count}
                </span>
            </button>
            {/* Conditionally render sub-items based on isOpen state */}
            {isOpen && (
                <div className="mt-1 space-y-1">
                    {/* Example Sub-Items - Replace with dynamic data later */}
                    <NavItem href="#" icon={StickyNote} label="Sub Note 1" isSubItem isActive={false} />
                    <NavItem href="#" icon={StickyNote} label="Sub Note 2" isSubItem isActive={false} />
                </div>
            )}
        </div>
    );
};

function Sidebar() {
    // Placeholder active state - replace with actual router logic
    const currentPath = "/dashboard"; // Example

    return (
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
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Plus className="h-4 w-4" />
                                <span className="sr-only">New Folder</span>
                            </Button>
                        </div>
                        <div className="space-y-1 px-2 lg:px-4">
                            {/* Replace with dynamic folder data */}
                            <FolderItem label="All Notes" count={12} isActive={false}/>
                            <FolderItem label="Physics" count={5} isActive={false}/>
                            <FolderItem label="Mathematics" count={3} isActive={true}/> {/* Example active folder */}
                            <FolderItem label="History" count={4} isActive={false}/>
                            <FolderItem label="Programming" count={0} isActive={false}/>
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
    );
}

export default Sidebar; 