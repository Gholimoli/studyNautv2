import React from 'react';
import { motion } from 'framer-motion'; // Ensure motion is imported
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Import mutation hooks
import { useToast } from "@/hooks/use-toast"; // Import toast hook
import { Card, CardContent } from '@/components/ui/card'; // Restore CardContent
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"; // Restore Skeleton
import { cn } from '@/lib/utils';
import {
    FileText,
    Video,
    Mic,
    ImageDown as Image,
    CalendarDays,
    Tags,
    Star,
    Loader2 // Import loader icon
} from "lucide-react";
import { NoteFolderMenu } from '@/components/notes/NoteFolderMenu';

// --- Types (Matching NotesIndexPage) --- 
type NoteSourceType = 'PDF' | 'YouTube' | 'Audio' | 'Image' | 'Text';
interface Note {
    id: number;
    title: string;
    summary?: string;
    sourceType: NoteSourceType;
    createdAt: string | Date;
    folderId?: number | null;
    isFavorite?: boolean;
    tags?: { id: number; name: string }[];
    languageCode?: string;
}

// --- Helper Functions (Copied from NotesIndexPage for standalone use) ---
// TODO: Move these to shared utils if used elsewhere
function formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function LanguageIndicator({ languageCode }: { languageCode?: string }) {
    if (!languageCode) return null;
    let flag = '🏳️';
    const upperCode = languageCode.toUpperCase();
    switch (languageCode.toLowerCase()) {
        case 'en': flag = '🇬🇧'; break;
        case 'fr': flag = '🇫🇷'; break;
        case 'es': flag = '🇪🇸'; break;
        case 'de': flag = '🇩🇪'; break;
    }
    return (
        <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 h-5 whitespace-nowrap bg-background">
            <span className="mr-1">{flag}</span>
            {upperCode}
        </Badge>
    );
}

function getSourceBorderColor(sourceType: NoteSourceType): string {
    switch (sourceType) {
        case 'PDF': return "border-l-primary/80";
        case 'YouTube': return "border-l-destructive/80";
        case 'Audio': return "border-l-secondary/80";
        case 'Image': return "border-l-success/80";
        case 'Text': return "border-l-info/80";
        default: return "border-l-muted/80";
    }
}

const getSourceIcon = (sourceType: NoteSourceType): React.ReactElement => {
    switch (sourceType) {
        case 'PDF': return <FileText className="h-4 w-4" />;
        case 'YouTube': return <Video className="h-4 w-4" />;
        case 'Audio': return <Mic className="h-4 w-4" />;
        case 'Image': return <Image className="h-4 w-4" />;
        case 'Text':
        default: return <FileText className="h-4 w-4" />;
    }
};
// --------------------------------------------------

// --- Placeholder API Function (Move to API layer later) ---
const placeholderToggleFavorite = async ({ noteId, isFavorite }: { noteId: number; isFavorite: boolean }): Promise<Note> => { 
    console.warn(`NOTE CARD API: Toggle favorite for ${noteId} needs implementation`); 
    await new Promise(r => setTimeout(r, 300)); 
    // Simulate returning updated note data
    // In a real API, you'd return the actual updated note from the DB
    const updatedNote = { 
        // Spread existing note properties if available, otherwise use placeholders
        id: noteId, 
        title: 'Updated Note Title', 
        sourceType: 'Text' as NoteSourceType,
        createdAt: new Date().toISOString(),
        // ... other properties ...
        isFavorite: !isFavorite 
    };
    return updatedNote;
};

// --- Note Card Skeleton --- 
export const NoteCardSkeleton = () => {
  return (
    <Card className="overflow-hidden border-l-4 border-l-muted/80">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex space-x-2 pt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </CardContent>
      <div className="border-t border-border/50 px-4 py-2 h-[45px]">
         {/* Minimal footer skeleton */}
      </div>
    </Card>
  );
};

// --- Note Card Component --- 
interface NoteCardProps {
    note: Note;
    onClick: () => void; 
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick }) => {
    // Log incoming props
    console.log(`[NoteCard Render] ID: ${note.id}, isFavorite: ${note.isFavorite}`);

    const SourceIcon = getSourceIcon(note.sourceType);
    const summary = note.summary || generatePlaceholderSummary(note);
    const tags = note.tags || [];
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // --- Favorite Mutation ---
    const toggleFavoriteMutation = useMutation<Note, Error, { noteId: number; isFavorite: boolean }>({ 
        mutationFn: placeholderToggleFavorite,
        onSuccess: (updatedNoteData, variables) => {
            // Update the cache directly for immediate UI feedback
            queryClient.setQueryData<Note[]>(['notes'], (oldData) => {
                console.log(`[Cache Update] Updating note ID: ${variables.noteId}. Current favorite: ${variables.isFavorite}`);
                if (!oldData) {
                    console.log("[Cache Update] No old data found.");
                    return [];
                }
                // Create a new array with the updated note
                const newData = oldData.map(n => {
                    if (n.id === variables.noteId) {
                        console.log(`[Cache Update] Found note ${n.id}, changing favorite to ${!variables.isFavorite}`);
                        return { ...n, isFavorite: !variables.isFavorite };
                    }
                    return n;
                });
                console.log("[Cache Update] New data generated:", newData);
                return newData;
            });

            // Invalidate but DON'T refetch immediately, let the optimistic update stick
            queryClient.invalidateQueries({ queryKey: ['notes'], refetchType: 'none' }); 

            toast({
                title: !variables.isFavorite ? "Added to Favorites" : "Removed from Favorites",
            });
        },
        onError: (error) => {
            toast({ 
                title: "Error Updating Favorite", 
                description: error.message,
                variant: "destructive" 
            });
        },
    });

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card navigation click
        toggleFavoriteMutation.mutate({ noteId: note.id, isFavorite: !!note.isFavorite });
    };

    return (
        // Add h-full back to motion div
        <motion.div
            whileHover={{ scale: 1.005 }}
            className="h-full" 
        >
            <Card 
                // Add h-full back to Card
                className={cn(
                    "overflow-hidden transition-shadow duration-200 flex flex-col h-full group", 
                    "border-l-4", 
                    getSourceBorderColor(note.sourceType)
                )}
            >
                {/* Add h-full to CardContent, keep flex flex-col */}
                <CardContent className="p-4 cursor-pointer flex flex-col h-full" onClick={onClick}> 
                    {/* Top section: Meta-info on left, Actions on right */}
                    <div className="flex items-start justify-between mb-2"> 
                        {/* Left side: Meta info */}
                        <div className="flex-shrink min-w-0 mr-4"> 
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap">
                                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                    <span>{formatDate(note.createdAt).split(',')[0]}</span> 
                                </div>
                                <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 h-5 whitespace-nowrap bg-background flex items-center">
                                    {React.cloneElement(SourceIcon, { className: "h-3 w-3 mr-1" } as any)}
                                    {note.sourceType}
                                </Badge>
                                <LanguageIndicator languageCode={note.languageCode} />
                            </div>
                        </div>
                        {/* Right side: Actions */}
                        <div className="flex items-center space-x-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}> 
                            <Button 
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-7 w-7 rounded-full text-muted-foreground hover:text-amber-500",
                                    note.isFavorite && "text-amber-500 fill-amber-400"
                                )}
                                onClick={handleToggleFavorite} 
                                disabled={toggleFavoriteMutation.isPending} // Disable button when loading
                                aria-label={note.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                            >
                                {toggleFavoriteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Star className="h-4 w-4" />
                                )}
                            </Button>
                            <NoteFolderMenu note={note} />
                        </div>
                    </div>

                    {/* Note Title */}
                    <h3 className="font-semibold text-base mb-1.5 line-clamp-2 group-hover:text-primary transition-colors" title={note.title}>
                        {note.title}
                    </h3>
                    
                    {/* Summary/Excerpt - NO flex-grow here */}
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2" title={summary}>
                        {summary}
                    </p>
                    
                    {/* Conditionally render tags or empty flex-grow spacer */}
                    {tags.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 flex-grow items-end"> 
                            <Tags className="h-3.5 w-3.5 text-muted-foreground mr-0.5 mb-0.5" /> 
                            {tags.slice(0, 4).map((tag) => (
                                <Badge 
                                    key={tag.id} 
                                    variant="secondary"
                                    className="text-xs font-normal px-1.5 py-0 h-5 whitespace-nowrap"
                                >
                                    {tag.name}
                                </Badge>
                            ))}
                            {tags.length > 4 && (
                                <Badge 
                                    variant="secondary"
                                    className="text-xs font-normal px-1.5 py-0 h-5 whitespace-nowrap"
                                >
                                    +{tags.length - 4} more
                                </Badge>
                            )}
                        </div>
                    ) : (
                       <div className="flex-grow"></div> // Empty div with flex-grow
                    )}
                </CardContent>

                {/* NO FOOTER */}
            </Card>
        </motion.div>
    );
};

// Placeholder summary function needs to be defined if used
function generatePlaceholderSummary(note: Note): string {
    const summaries = {
        PDF: "Summary from PDF document.",
        YouTube: "Key points from YouTube video.",
        Audio: "Transcription highlights from audio.",
        Image: "Information extracted from image.",
        Text: "Overview of the provided text."
    };
    return note.summary || summaries[note.sourceType] || "General note summary.";
} 