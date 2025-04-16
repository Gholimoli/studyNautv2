import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router'; // Using TanStack Router
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
  Trash2 // Added Trash icon
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

// --- Types (Placeholder - Define these properly, possibly in shared package) ---
type NoteSourceType = 'PDF' | 'YouTube' | 'Audio' | 'Image' | 'Text';

interface Note {
  id: number;
  title: string;
  summary?: string;
  content?: string; // For tag generation fallback
  sourceType: NoteSourceType;
  createdAt: string | Date;
  folderId?: number | null;
  isFavorite?: boolean;
  tags?: { id: number; name: string }[];
  languageCode?: string; // Added language code
}

interface FolderType {
  id: number;
  name: string;
}
// -----------------------------------------------------------------------------

// --- Mock Data (Placeholders - Uncommented for placeholder API functions) ---
const mockNotesData: Note[] = [
  { id: 1, title: 'Quantum Mechanics', sourceType: 'PDF', createdAt: '2025-04-01T10:00:00Z', isFavorite: true, folderId: 1, summary: 'Wave functions, Schrödinger equation...', languageCode: 'en', tags: [{id: 101, name: 'Physics'}, {id: 102, name: 'Quantum'}, {id: 103, name: 'Advanced'}] },
  { id: 2, title: 'Neural Networks', sourceType: 'YouTube', createdAt: '2025-03-30T11:30:00Z', isFavorite: false, folderId: 2, summary: 'Deep learning, activation functions...', languageCode: 'en', tags: [{id: 201, name: 'AI'}, {id: 202, name: 'Deep Learning'}, {id: 203, name: 'CS'}] },
  { id: 3, title: 'Événements WWII', sourceType: 'Text', createdAt: '2025-03-28T15:00:00Z', isFavorite: false, folderId: 1, summary: 'Chronologie des batailles et de la politique...', languageCode: 'fr', tags: [{id: 301, name: 'History'}, {id: 302, name: 'War'}] },
  { id: 4, title: 'Organic Chemistry Intro', sourceType: 'PDF', createdAt: '2025-03-25T09:00:00Z', isFavorite: false, summary: 'Functional groups, nomenclature...', languageCode: 'en', tags: [{id: 401, name: 'Chemistry'}, {id: 402, name: 'Organic'}, {id: 403, name: 'Intro'}, {id: 404, name: 'Science'}, {id: 405, name: 'Difficult'}] }, // Example with > 4 tags
  { id: 5, title: 'Grabación de la conferencia 1', sourceType: 'Audio', createdAt: '2025-03-22T14:00:00Z', isFavorite: true, summary: 'Transcripción de la primera conferencia...', languageCode: 'es' }, // No tags example
  { id: 6, title: 'Lab Results Scan', sourceType: 'Image', createdAt: '2025-03-20T16:45:00Z', isFavorite: false, folderId: 1, summary: 'Scan of the experimental data...', languageCode: 'en', tags: [{id: 601, name: 'Lab'}, {id: 602, name: 'Experiment'}] },
];

const mockFoldersData: FolderType[] = [
  { id: 1, name: 'Physics' },
  { id: 2, name: 'Comp Sci' },
  { id: 3, name: 'History' },
];
// -----------------------------------------------------------------------------

// --- Placeholder API Functions - COMMENT THESE OUT ---
/*
// Replace these with your actual API calls
const fetchFoldersApi = async (): Promise<FolderType[]> => {
  console.log("API: Fetching folders...");
  // const response = await apiRequest('/api/folders'); 
  // return response.folders;
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  return mockFoldersData; // Using mock data for now
};

const toggleFavoriteApi = async ({ noteId, isFavorite }: { noteId: number, isFavorite: boolean }): Promise<Note> => {
  console.log(`API: Toggling favorite for Note ${noteId} to ${!isFavorite}`);
  // const response = await apiRequest(`/api/notes/${noteId}`, { 
  //   method: 'PATCH', 
  //   body: JSON.stringify({ favorite: !isFavorite }) 
  // });
  // return response.note;
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  // Find and update mock data (example)
  const noteIndex = mockNotesData.findIndex((n: Note) => n.id === noteId); // Added type Note
  if (noteIndex > -1) {
    mockNotesData[noteIndex] = { ...mockNotesData[noteIndex], isFavorite: !isFavorite };
    return mockNotesData[noteIndex];
  }
  throw new Error("Note not found in mock data");
};

const moveNoteApi = async ({ noteId, folderId }: { noteId: number, folderId: number | null }): Promise<Note> => {
  console.log(`API: Moving Note ${noteId} to Folder ${folderId}`);
  // const response = await apiRequest(`/api/notes/${noteId}`, { 
  //   method: 'PATCH', 
  //   body: JSON.stringify({ folderId: folderId }) 
  // });
  // return response.note;
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
   // Find and update mock data (example)
  const noteIndex = mockNotesData.findIndex((n: Note) => n.id === noteId); // Added type Note
   if (noteIndex > -1) {
    mockNotesData[noteIndex] = { ...mockNotesData[noteIndex], folderId: folderId };
    return mockNotesData[noteIndex];
  }
  throw new Error("Note not found in mock data");
};

const deleteNoteApi = async ({ noteId }: { noteId: number }): Promise<void> => {
  console.log(`API: Deleting Note ${noteId}`);
  // await apiRequest(`/api/notes/${noteId}`, { method: 'DELETE' });
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  // Remove from mock data (example)
  const noteIndex = mockNotesData.findIndex((n: Note) => n.id === noteId); // Added type Note
  if (noteIndex > -1) {
     mockNotesData.splice(noteIndex, 1);
     return;
  }
   throw new Error("Note not found in mock data");
};
*/
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

// --- Sub-Components (Adapted from Snippet) ---

// --- Note Folder Dropdown Menu Component --- 
interface NoteFolderMenuProps {
  note: Note;
  stopPropagation?: boolean; // Optional prop to stop event bubbling if needed
}

function NoteFolderMenu({ note, stopPropagation = true }: NoteFolderMenuProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast(); // Assuming useToast hook setup
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch Folders
  // TODO: Replace mockFoldersData with a real API call function
  const { data: folders = [], isLoading: isLoadingFolders, error: foldersError } = useQuery<FolderType[]>({
    queryKey: ['folders'],
    queryFn: async () => { console.warn('fetchFoldersApi needs implementation!'); return mockFoldersData; }, // Using mock data as placeholder queryFn
    // staleTime: 5 * 60 * 1000, // Cache folders for 5 minutes
  });
  
  // --- Mutations ---
  // TODO: Replace mutationFn placeholders with real API call functions
  const moveNoteMutation = useMutation({
    mutationFn: async (vars: { noteId: number, folderId: number | null }) => { 
        console.warn('moveNoteApi needs implementation!'); 
        // Simulate success for UI feedback
        const noteIndex = mockNotesData.findIndex((n: Note) => n.id === vars.noteId);
        if (noteIndex > -1) {
            mockNotesData[noteIndex] = { ...mockNotesData[noteIndex], folderId: vars.folderId };
            return mockNotesData[noteIndex];
        }
        throw new Error('Simulated API error');
    },
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] }); // Adjust query key if needed
      // queryClient.invalidateQueries({ queryKey: ['folders'] }); // May need to update folder counts
      // queryClient.setQueryData(['note', updatedNote.id], updatedNote);
      const targetFolderName = folders.find(f => f.id === updatedNote.folderId)?.name || "Unfiled";
      toast({ title: "Note Moved", description: `Moved "${updatedNote.title}" to ${targetFolderName}.` });
    },
    onError: (error) => {
      toast({ title: "Error moving note", description: error.message, variant: "destructive" });
    },
  });
  
  const deleteNoteMutation = useMutation({
     mutationFn: async (vars: { noteId: number }) => { 
        console.warn('deleteNoteApi needs implementation!'); 
        // Simulate success for UI feedback
        const noteIndex = mockNotesData.findIndex((n: Note) => n.id === vars.noteId);
        if (noteIndex > -1) {
            mockNotesData.splice(noteIndex, 1);
            return;
        }
         throw new Error('Simulated API error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] }); // Adjust query key if needed
      toast({ title: "Note Deleted", description: `"${note.title}" has been deleted.` });
      setIsDeleteDialogOpen(false); // Close dialog on success
    },
    onError: (error) => {
      toast({ title: "Error deleting note", description: error.message, variant: "destructive" });
      setIsDeleteDialogOpen(false); // Close dialog on error too
    },
  });

  // --- Event Handlers ---
  const handleMoveToFolder = (e: React.MouseEvent, folderId: number | null) => { 
    if (stopPropagation) { e.stopPropagation(); e.preventDefault(); }
    if (note.folderId === folderId) return; 
    moveNoteMutation.mutate({ noteId: note.id, folderId: folderId });
  };
  
   // Triggered by the AlertDialog's confirmation button
  const confirmDelete = () => {
    deleteNoteMutation.mutate({ noteId: note.id });
  };
  
  // --- Render Logic ---
  // Basic loading/error for folders - enhance as needed
  if (isLoadingFolders) return <Skeleton className="h-8 w-8 rounded-full" />; 
  if (foldersError) {
      console.error("Error loading folders:", foldersError);
      // Maybe show a disabled button or an error icon
      return <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled><MoreHorizontal className="h-4 w-4" /></Button>;
  }
  
  return (
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => stopPropagation && e.stopPropagation()}> 
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground data-[state=open]:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56" 
          onClick={(e: React.MouseEvent) => stopPropagation && e.stopPropagation()}
        > 
          <DropdownMenuLabel>Note Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* --- Move to Folder Section --- */}
          {/* Consider using DropdownMenuSub if folders list gets very long */}
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2">Move to folder</DropdownMenuLabel>
          
          {/* Unfiled Option */}
          <DropdownMenuItem 
            onClick={(e) => handleMoveToFolder(e, null)}
            className={cn(!note.folderId && "bg-accent/50")} // Highlight if current
            disabled={moveNoteMutation.isPending || !note.folderId} // Disable if already unfiled or moving
          >
            <FolderPlus className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Unfiled</span>
            {!note.folderId && <span className="ml-auto text-xs text-primary font-medium">Current</span>}
          </DropdownMenuItem>
          
          {/* Folder List */}
          {folders.map(folder => (
            <DropdownMenuItem 
              key={folder.id}
              onClick={(e) => handleMoveToFolder(e, folder.id)}
              className={cn(note.folderId === folder.id && "bg-accent/50")} // Highlight if current
              disabled={moveNoteMutation.isPending || note.folderId === folder.id} // Disable if already in folder or moving
            >
              <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="truncate">{folder.name}</span>
              {note.folderId === folder.id && <span className="ml-auto text-xs text-primary font-medium">Current</span>}
            </DropdownMenuItem>
          ))}
          {/* --- End Move to Folder Section --- */}

          <DropdownMenuSeparator />

          {/* Delete Item - Triggers AlertDialog */}
           <AlertDialogTrigger asChild>
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                disabled={deleteNoteMutation.isPending} // Disable while deleting
                // We don't call delete directly here, just open the dialog
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Note</span>
              </DropdownMenuItem>
            </AlertDialogTrigger>

        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialogContent onClick={(e: React.MouseEvent) => stopPropagation && e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the note
            <span className="font-semibold"> "{note.title}"</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteNoteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmDelete} 
            disabled={deleteNoteMutation.isPending}
            className={cn(deleteNoteMutation.isPending && "opacity-50 cursor-not-allowed")} // Basic loading state
          >
            {deleteNoteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


// --- Main Page Component --- 

export function NotesIndexPage() {
  // const [, setLocation] = useLocation(); // Use TanStack's navigate
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  
  // TODO: Replace with actual useQuery
  const isLoading = false; // Placeholder
  const notes = mockNotesData; // Placeholder
  
  // Function to get icon based on source type (simplified, only returns component)
  const getSourceIcon = (sourceType: NoteSourceType): React.ReactElement => {
    switch (sourceType) {
      case 'PDF': return <FileText className="h-3 w-3 mr-1" />; // Adjusted size
      case 'YouTube': return <Video className="h-3 w-3 mr-1" />; // Adjusted size
      case 'Audio': return <Mic className="h-3 w-3 mr-1" />; // Adjusted size
      case 'Image': return <Image className="h-3 w-3 mr-1" />; // Adjusted size
      case 'Text': 
      default: return <FileText className="h-3 w-3 mr-1" />; // Adjusted size, default to text
    }
  };

  // Filtering logic (Placeholder) - Now uses activeTab state
  const filteredNotes = notes
    ? activeTab === "favorites" 
      ? notes.filter(note => note.isFavorite)
      : activeTab === "recently" // "Recently" needs actual view tracking or sort by date
        ? [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)
        : notes // Default to all
    : [];
  
  // Sorting remains by creation date desc
  const sortedNotes = [...(filteredNotes || [])].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  const handleNoteClick = (noteId: number) => {
    navigate({ to: '/notes/$noteId', params: { noteId: String(noteId) } });
  };
  
  const handleCreateClick = () => {
    navigate({ to: '/' }); // TODO: Update to actual create path when defined
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

  // --- Favorite Mutation (moved here or defined inline below) ---
  // Placeholder mutation - replace with actual API call
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (vars: { noteId: number, isFavorite: boolean }) => { 
        console.warn('toggleFavoriteApi needs implementation!'); 
        const noteIndex = mockNotesData.findIndex((n: Note) => n.id === vars.noteId);
        if (noteIndex > -1) {
            mockNotesData[noteIndex] = { ...mockNotesData[noteIndex], isFavorite: !vars.isFavorite };
            return mockNotesData[noteIndex];
        }
        throw new Error('Simulated API error');
    },
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] }); 
      toast({ title: updatedNote.isFavorite ? "Added to Favorites" : "Removed from Favorites" });
    },
    onError: (error) => {
      toast({ title: "Error updating favorite", description: error.message, variant: "destructive" });
    },
  });

  // Handler for the new favorite button
  const handleToggleFavorite = (e: React.MouseEvent, note: Note) => { 
      e.stopPropagation(); // Prevent card click
      toggleFavoriteMutation.mutate({ noteId: note.id, isFavorite: !!note.isFavorite });
  };
  
  return (
    // Assuming MainLayout is handled by root route, just provide content
    <div className="container mx-auto py-8 px-4 md:px-6 space-y-6">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2"
      >
        <div>
          <h1 className="text-2xl font-semibold text-foreground">All Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and organize your study materials</p>
        </div>
        {/* Any header actions like Create button could go here */}
      </motion.div>

      {/* Tabs Section - Keep commented out per user request */}
      {/* 
      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="border-b bg-transparent p-0 h-auto justify-start rounded-none">
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-muted-foreground data-[state=active]:text-primary text-sm"
          >
            All Notes
          </TabsTrigger>
          <TabsTrigger 
            value="recently" 
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-muted-foreground data-[state=active]:text-primary text-sm ml-6"
          >
            Recently Viewed
          </TabsTrigger>
          <TabsTrigger 
            value="favorites" 
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-muted-foreground data-[state=active]:text-primary text-sm ml-6"
          >
            Favorites
          </TabsTrigger>
        </TabsList>
      </Tabs>
      */}
      
      {/* Note List Area - Now outside the header's flex container */}
      {isLoading ? (
        <div className="space-y-4 mt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg w-full" />
          ))}
        </div>
      ) : sortedNotes.length > 0 ? (
        <motion.div 
          className="space-y-4 mt-4"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {sortedNotes.map(note => (
            <motion.div 
              key={note.id}
              variants={itemVariants}
              whileHover={{ scale: 1.005, borderColor: "hsl(var(--primary)/0.3)" }} // Subtle scale and theme border
              className={cn(
                  `border rounded-lg bg-card text-card-foreground shadow-sm cursor-pointer transition-all overflow-hidden border-l-4`,
                  getSourceBorderColor(note.sourceType) // Use updated border colors
              )}
              onClick={() => handleNoteClick(note.id)}
            >
              {/* Use CardContent for padding */}
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Main content area */}
                  <div className="flex-1 overflow-hidden">
                    {/* Top meta line: Date + Badges */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2"> {/* Increased gap slightly */} 
                      <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                        <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                        <span>{formatDate(note.createdAt)}</span>
                      </div>
                      {/* Source Type Badge */}
                      <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 h-5 whitespace-nowrap bg-background">
                        {getSourceIcon(note.sourceType)}
                        {note.sourceType}
                      </Badge>
                      {/* Language Indicator */}
                      <LanguageIndicator languageCode={note.languageCode} />
                    </div>
                    
                    {/* Note Title */}
                    <h3 className="text-base sm:text-lg font-semibold text-foreground truncate mb-1.5" title={note.title}>
                      {note.title}
                    </h3>
                    
                    {/* Summary/Excerpt */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3" title={note.summary}>
                      {note.summary}
                    </p>

                    {/* Tags Area */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Tags className="h-3.5 w-3.5 text-muted-foreground mr-0.5" /> 
                        {note.tags.slice(0, 4).map(tag => ( // Limit displayed tags
                          <Badge 
                            key={tag.id} 
                            variant="default" // Ensure this is default
                            className="text-xs font-medium px-2 py-0 h-5" // Ensure style updates are applied
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {note.tags.length > 4 && (
                          <Badge 
                            variant="default" // Ensure this is default
                            className="text-xs font-medium px-2 py-0 h-5" // Ensure style updates are applied
                          >
                            +{note.tags.length - 4} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Actions Column (aligned right) */}
                  <div className="flex items-center justify-start pt-1 space-x-1"> {/* Use flex-row (items-center) and space-x */} 
                    {/* Favorite Button */}
                    <Button 
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-full text-muted-foreground hover:text-amber-500",
                        note.isFavorite ? "text-amber-500 fill-amber-400" : "hover:fill-amber-400/20"
                      )}
                      onClick={(e) => handleToggleFavorite(e, note)}
                      disabled={toggleFavoriteMutation.isPending}
                      aria-label={note.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                    {/* Note Folder Menu Button */}
                    <NoteFolderMenu note={note} />
                  </div>
                </div>
              </CardContent>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        // Empty State 
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-center py-16 bg-muted/50 rounded-lg border border-dashed mt-4"
          >
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No notes found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "favorites"
              ? "You haven't added any notes to favorites yet."
              : activeTab === "recently"
                ? "You haven't viewed any notes recently."
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