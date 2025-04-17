import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from '@tanstack/react-router'; // Using TanStack Router
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Added useQueryClient
// import MainLayout from '@/components/layouts/main-layout'; // Assuming Layout is handled by App.tsx root route
// TODO: Add Tabs component (`pnpm dlx shadcn-ui@latest add tabs`)
// import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Commented out again
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Video, // Keep for mapping, might use Youtube icon visually
  Mic, 
  ImageDown as Image, // Using consistent icon
  Plus, 
  CalendarDays, 
  ChevronRight, 
  Star, 
  FolderPlus, 
  Folder, 
  MoreHorizontal, 
  Tags,
  Trash2, // Added Trash icon
  Edit, // Added Edit icon
  Move // Added Move icon
} from "lucide-react";
// import { Note, Folder as FolderType } from "@shared/schema"; // Assuming types are defined or imported elsewhere
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
// Remove the incorrect queryClient import from here - This line should be deleted
// import { apiRequest /* , queryClient */ } from "@/lib/queryClient"; 
import { useToast } from "@/hooks/use-toast"; // Correct path now
// import { useToast } from "@/components/ui/use-toast"; // Original incorrect path from shadcn add, might need adjustment
// TODO: Add DropdownMenu component (`pnpm dlx shadcn-ui@latest add dropdown-menu`)
import { Card, CardContent } from '@/components/ui/card'; // Use shadcn Card
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub, // Added for potential nested menus later
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
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
} from "@/components/ui/alert-dialog"; // Added AlertDialog
// import { MoveNoteDialog } from '@/components/notes/MoveNoteDialog'; // Import the new dialog
import { NoteCard } from '@/components/notes/NoteCard'; // <-- IMPORT NOTECARD
// Import mock data and types from the new central location
import { Note, FolderType, NoteSourceType, mockNotesData, mockFoldersData } from '@/lib/mockData';
// Import useFolders to get folder names
import { useFolders } from '@/hooks/useFolderQueries'; 

// --- Types (Removed - Now imported) ---
// type NoteSourceType = 'PDF' | 'YouTube' | 'Audio' | 'Image' | 'Text';
// interface Note { ... }
// interface FolderType { ... }
// -----------------------------------------------------------------------------

// --- Mock Data (Removed - Now imported) ---
// const mockNotesData: Note[] = [ ... ];
// const mockFoldersData: FolderType[] = [ ... ];
// -----------------------------------------------------------------------------

// --- Helper Functions (Adapted from Snippet) ---

// Format date like "Apr 1, 2025, 10:00 AM"
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

// Placeholder summary generation (Simplified)
function generatePlaceholderSummary(note: Note): string {
  const sourceBasedSummary: Partial<Record<NoteSourceType, string>> = {
    'YouTube': 'Summary of video key points.',
    'PDF': 'Key information extracted from document.',
    'Audio': 'Transcribed audio summary.',
    'Image': 'Extracted text and visual info.',
    'Text': 'Concise summary of the text.'
  };
  return note.summary || sourceBasedSummary[note.sourceType] || 'Overview of this note.';
}

// Placeholder tag generation (Simplified)
function generateTagsForNote(note: Note): string[] {
  const tags: string[] = [];
  if (note.title.toLowerCase().includes('quantum')) tags.push('physics', 'quantum');
  if (note.title.toLowerCase().includes('network')) tags.push('ai', 'cs');
  if (note.title.toLowerCase().includes('wwii')) tags.push('history');
  if (note.sourceType === 'YouTube') tags.push('video');
  if (note.sourceType === 'Audio') tags.push('audio-log');
  if (tags.length === 0) tags.push('general');
  return tags.slice(0, 4); // Limit tags
}

// Function to get language flag emoji and code
function LanguageIndicator({ languageCode }: { languageCode?: string }) {
  if (!languageCode) return null;

  let flag = '🏳️'; // Default flag
  const upperCode = languageCode.toUpperCase();

  // Basic mapping (expand as needed)
  switch (languageCode.toLowerCase()) {
    case 'en': flag = '🇬🇧'; break; // Or 🇺🇸
    case 'fr': flag = '🇫🇷'; break;
    case 'es': flag = '🇪🇸'; break;
    case 'de': flag = '🇩🇪'; break;
    // Add more languages
  }

  return (
    <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 h-5 whitespace-nowrap bg-background">
      <span className="mr-1">{flag}</span>
      {upperCode}
    </Badge>
  );
}

// Map source type to theme border color class
function getSourceBorderColor(sourceType: NoteSourceType): string {
  switch (sourceType) {
    case 'PDF':
      return "border-l-primary/80"; // Changed to Purple
    case 'YouTube': 
      return "border-l-destructive/80"; // Red
    case 'Audio': 
      return "border-l-secondary/80"; // Gray
    case 'Image': 
      return "border-l-success/80"; // Green
    case 'Text': 
      return "border-l-info/80"; // Blue
    default: 
      return "border-l-muted/80"; // Use muted as a fallback instead of primary
  }
}
// -----------------------------------------------------------------------------

// --- Main Page Component --- 

export function NotesIndexPage() {
  const navigate = useNavigate();
  const location = useLocation(); // Get location info
  // Get route parameters
  // Use `strict: false` to allow matching even if it's not the absolute end route (e.g., future nested folder routes)
  const params = useParams({ strict: false }); 
  const routeFolderId = params.folderId ? parseInt(params.folderId, 10) : null;

  // Get folder data to find the name for the title
  const { data: foldersData } = useFolders(); 

  // Determine if we are on the favorites route
  const isFavoritesView = location.pathname === '/notes/favorites';

  const { data: notesData, isLoading, error } = useQuery<Note[], Error>({
    queryKey: ['notes'],
    queryFn: async () => { 
      // Load notes from localStorage source
      const { mockNotesData: currentNotes } = await import('@/lib/mockData');
      console.log("NotesIndexPage: Using notes data from mockData module.");
      return currentNotes; 
    }, 
  });
  
  // Filtering logic: Apply favorites OR folderId filter
  const filteredNotes = notesData
    ? isFavoritesView
      ? notesData.filter(note => note.isFavorite)
      : routeFolderId !== null // Check if filtering by folder ID
        ? notesData.filter(note => note.folderId === routeFolderId)
        : notesData // Default to all notes (pathname === '/notes')
    : [];
  
  // Sorting remains by creation date desc
  const sortedNotes = [...(filteredNotes || [])].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  // Navigation handler passed to NoteCard
  const handleNoteClick = (noteId: number) => {
    navigate({ to: '/notes/$noteId', params: { noteId: String(noteId) } });
  };
  
  const handleCreateClick = () => {
    navigate({ to: '/' }); // TODO: Update path
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };
  
  const queryClient = useQueryClient();
  const { toast } = useToast(); // Keep toast hook here if needed elsewhere or for favorite

  // Find the current folder name for the title
  // TODO: This assumes a flat folder list from useFolders for now.
  // Need a recursive find function if hierarchy is deeply nested.
  const currentFolder = routeFolderId !== null && foldersData 
    ? foldersData.find(f => f.id === routeFolderId)
    : null;

  // Determine Page Title based on view
  let pageTitle = "All Notes";
  if (isFavoritesView) {
    pageTitle = "Favorite Notes";
  } else if (currentFolder) {
    pageTitle = currentFolder.name; // Use the folder name
  }

  return (
    // Assuming MainLayout is handled by root route, just provide content
    <div className="container mx-auto py-8 px-4 md:px-6 space-y-6">
      {/* Header Section - Updated Title */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2"
      >
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{pageTitle}</h1>
          {/* Optional: Add description or breadcrumbs here */}
          {/* <p className="text-sm text-muted-foreground mt-1">...</p> */}
        </div>
        {/* Any header actions like Create button could go here */}
      </motion.div>

      {/* Tabs Section - Can be removed completely now */}
      
      {/* Note List Area (Remains the same, uses filteredNotes) */}
      {isLoading ? (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg w-full" />
          ))}
        </div>
      ) : error ? (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-center py-16 bg-muted/50 rounded-lg border border-dashed mt-4"
          >
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Error: {error.message}</h3>
          <Button className="mt-6" size="sm" onClick={handleCreateClick}>
            <Plus className="mr-1 h-4 w-4" />
            Create Note
          </Button>
        </motion.div>
      ) : sortedNotes.length > 0 ? (
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4" 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {sortedNotes.map(note => (
            <motion.div 
              key={note.id}
              variants={itemVariants} 
              className={cn("rounded-lg overflow-hidden")} 
            >
              <NoteCard 
                note={note} 
                onClick={() => handleNoteClick(note.id)} 
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        // Empty State - Adjust message based on view
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-center py-16 bg-muted/50 rounded-lg border border-dashed mt-4"
          >
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {isFavoritesView
              ? "No favorite notes found"
              : currentFolder
                ? `No notes found in "${currentFolder.name}"`
                : "No notes found"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFavoritesView 
              ? "Click the star on a note to add it to favorites."
              : currentFolder
                ? `Move notes into the "${currentFolder.name}" folder to see them here.`
                : "Get started by creating your first note!"}
          </p>
          <Button className="mt-6" size="sm" onClick={handleCreateClick}>
            <Plus className="mr-1 h-4 w-4" />
            Create Note
          </Button>
        </motion.div>
      )}
    </div>
  );
} 