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
// Remove mock data import for notes, keep others if needed
// import { Note, FolderType, NoteSourceType, mockNotesData, mockFoldersData } from '@/lib/mockData'; 
// Import only necessary types from mockData if needed elsewhere
// Remove this import as mockData.ts is deleted
// import type { FolderType } from '@/lib/mockData'; 
// Import the actual query hook
import { useGetNotesQuery, type NoteListItem, type GetNotesParams } from '@/hooks/useNotesQueries'; 
// Import useFolders to get folder names
import { useFolders } from '@/hooks/useFolderQueries'; 

// --- Helper Functions ---
// Keep only essential helpers like formatDate
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

// --- Main Page Component --- 

export function NotesIndexPage() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const params = useParams({ strict: false }); 
  const routeFolderId = params.folderId ? parseInt(params.folderId, 10) : null;
  const { data: foldersData } = useFolders(); 
  // const queryClient = useQueryClient(); // queryClient seems unused here
  // const { toast } = useToast(); // toast seems unused here

  const isFavoritesView = location.pathname === '/notes/favorites';

  // --- Recalculate queryParams using useMemo --- 
  const queryParams: GetNotesParams = React.useMemo(() => {
    const paramsForQuery: GetNotesParams = {
      limit: 50,
      offset: 0,
    };
    if (isFavoritesView) {
      paramsForQuery.favorite = true;
    } else if (routeFolderId !== null) {
      paramsForQuery.folderId = routeFolderId;
    }
    // No else: For "All Notes", neither favorite nor folderId is set.
    console.log("[NotesIndexPage] Calculated Query Params:", paramsForQuery);
    return paramsForQuery;
  }, [isFavoritesView, routeFolderId]); // Dependencies: view type, folder ID

  // console.log("[NotesIndexPage] Query Params for fetch:", queryParams); // Replaced by useMemo log

  const { 
    data: notesResponse, 
    isLoading,
    error
  } = useGetNotesQuery(queryParams);
  
  const notesData = notesResponse?.notes ?? [];
  const totalNotes = notesResponse?.total ?? 0;

  const sortedNotes = [...notesData].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
  
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
  
  const currentFolder = routeFolderId !== null && foldersData 
    ? foldersData.find(f => f.id === routeFolderId)
    : null;

  let pageTitle = "All Notes";
  if (isFavoritesView) {
    pageTitle = "Favorite Notes";
  } else if (currentFolder) {
    pageTitle = currentFolder.name;
  }

  // --- Add diagnostic logs ---
  console.log('[NotesIndexPage Rendering State]', {
    isLoading,
    error: error ? error.message : null,
    notesCount: sortedNotes.length,
    currentFolder: currentFolder ? { id: currentFolder.id, name: currentFolder.name } : null,
    isFavoritesView
  });
  // --- End diagnostic logs ---

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2"
      >
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{pageTitle}</h1>
        </div>
      </motion.div>

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
          className="flex flex-col gap-4 mt-4" 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {sortedNotes.map(note => (
            <motion.div 
              key={note.id}
              variants={itemVariants}
            >
               <NoteCard
                note={note}
                onClick={() => handleNoteClick(note.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
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