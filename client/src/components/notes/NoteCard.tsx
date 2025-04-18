import React from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from '@/lib/utils';
import {
    FileText,
    Video,
    Mic,
    Image as ImageIcon,
    CalendarDays,
    Tags,
    Star,
    Loader2,
    Clock,
    Globe
} from "lucide-react";
import { NoteFolderMenu } from '@/components/notes/NoteFolderMenu';
import type { Tag } from '@shared/types/notes';
import { useUpdateNote } from '@/hooks/useNotesQueries';
import type { NoteListItem as Note } from '@shared/types/notes';
import { formatDistanceToNow } from 'date-fns';

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
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </CardContent>
      <div className="border-t border-border/50 px-4 py-2 h-[45px]">
         {/* Minimal footer skeleton */}
      </div>
    </Card>
  );
};

interface NoteCardProps {
    note: Note;
    onClick: () => void; 
}

// Define NoteSourceType locally for helpers
export type NoteSourceType = 'PDF' | 'YouTube' | 'Audio' | 'Image' | 'Text' | 'YOUTUBE' | 'AUDIO' | 'IMAGE' | 'TEXT';

// --------------------------------------------------
// --- Helper Functions (Kept local) ---
// --------------------------------------------------

const formatRelativeDate = (date: string | Date): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

// Map backend sourceType (uppercase) to frontend PascalCase
function normalizeSourceType(sourceType: string): NoteSourceType {
    switch (sourceType?.toUpperCase()) { // Handle potential undefined/null and ensure uppercase comparison
        case 'YOUTUBE': return 'YouTube';
        case 'AUDIO': return 'Audio';
        case 'IMAGE': return 'Image';
        case 'TEXT': return 'Text';
        case 'PDF': return 'PDF';
        default: return 'Text'; // Default to Text
    }
}

function getSourceBorderColor(normalizedSourceType: NoteSourceType): string {
    switch (normalizedSourceType) {
        case 'PDF': return "border-l-primary/80";
        case 'YouTube': return "border-l-destructive/80";
        case 'Audio': return "border-l-secondary/80";
        case 'Image': return "border-l-success/80";
        case 'Text': return "border-l-info/80";
        default: return "border-l-muted/80";
    }
}

const getSourceIcon = (normalizedSourceType: NoteSourceType): React.ReactElement => {
    switch (normalizedSourceType) {
        case 'PDF': return <FileText className="h-4 w-4" />;
        case 'YouTube': return <Video className="h-4 w-4" />;
        case 'Audio': return <Mic className="h-4 w-4" />;
        case 'Image': return <ImageIcon className="h-4 w-4" />; // Use ImageIcon alias
        case 'Text':
        default: return <FileText className="h-4 w-4" />;
    }
}

// Simple language code to flag emoji mapping
const getFlagEmoji = (langCode: string | null | undefined): string => {
    if (!langCode) return '';
    const code = langCode.toLowerCase().split('-')[0]; // Use base language code (e.g., 'en' from 'en-US')
    switch (code) {
        case 'en': return '🇺🇸'; // Or 🇬🇧?
        case 'es': return '🇪🇸';
        case 'fr': return '🇫🇷';
        case 'de': return '🇩🇪';
        case 'it': return '🇮🇹';
        case 'pt': return '🇵🇹'; // Or 🇧🇷?
        case 'ja': return '🇯🇵';
        case 'ko': return '🇰🇷';
        case 'zh': return '🇨🇳';
        // Add more common languages as needed
        default: return ''; // No flag for unknown/unmapped codes
    }
};

// --------------------------------------------------
// --- Main Component ---
// --------------------------------------------------

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick }) => {
    // console.log(`[NoteCard Render] ID: ${note.id}, isFavorite: ${note.favorite}`);
    // console.log(`[NoteCard Render] Props received:`, note);

    const isFavorite = note.favorite; 
    const normalizedSourceType = normalizeSourceType(note.sourceType || 'Text');
    const SourceIconComponent = getSourceIcon(normalizedSourceType);
    const summary = note.summary || "No summary available.";
    const tags = note.tags || [];
    const queryClient = useQueryClient();
    const languageCode = note.languageCode; // Get language code
    const flagEmoji = getFlagEmoji(languageCode);
    const { toast } = useToast();

    const { mutate: toggleFavoriteMutate, isPending: isTogglingFavorite } = useUpdateNote(); 

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFavoriteMutate({ 
            noteId: note.id, 
            input: { favorite: !isFavorite } 
        });
    };

    return (
        <motion.div
            whileHover={{ scale: 1.005 }}
            className="h-full cursor-pointer"
            onClick={onClick}
        >
            <Card 
                className={cn(
                    "overflow-hidden transition-shadow duration-200 flex flex-col h-full group", 
                    "border-l-4", 
                    getSourceBorderColor(normalizedSourceType)
                )}
            >
                {/* Header: Contains all top-row elements */}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4"> 
                    {/* Left Side: Date, Flag, Lang, Source */}
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground flex-wrap">
                        <Clock className="h-3 w-3 flex-shrink-0" /> 
                        <span className="flex-shrink-0 whitespace-nowrap">{formatRelativeDate(note.createdAt)}</span> 

                        {/* Language and Flag Badge */} 
                        {languageCode && (
                            <Badge variant="outline" className="px-1.5 py-0.5 text-xs font-medium flex items-center space-x-1 flex-shrink-0">
                                {flagEmoji ? (
                                    <span className="leading-none">{flagEmoji}</span>
                                ) : (
                                    <Globe className="h-3 w-3" /> // Fallback icon
                                )}
                                <span className="leading-none">{languageCode.toUpperCase()}</span> 
                            </Badge>
                        )}

                        {/* Source Info */}
                        <div className="flex items-center space-x-1 flex-shrink-0">
                            {SourceIconComponent} 
                            <span>{normalizedSourceType}</span>
                        </div>
                    </div>

                    {/* Right Side: Actions (Star, Menu) */}
                    <div className="flex items-center space-x-0.5"> {/* Reduced space */}
                        <Button 
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-7 w-7 rounded-full text-muted-foreground hover:text-amber-500",
                                isFavorite && "text-amber-500 fill-amber-400" 
                            )}
                            onClick={handleToggleFavorite} 
                            disabled={isTogglingFavorite}
                            aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        >
                            {isTogglingFavorite ? ( 
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Star className="h-4 w-4" />
                            )}
                        </Button>
                        <NoteFolderMenu note={note as any} /> 
                    </div>
                </CardHeader>
                
                {/* Content: Title, Summary, Tags */}
                <CardContent className="px-4 pb-4 pt-0 flex-grow flex flex-col"> {/* Adjusted padding */}
                    {/* Title & Summary section */} 
                    <div className="flex-grow mb-3"> {/* Added margin-bottom */}
                        <h3 
                            className="font-semibold text-base mb-1.5 line-clamp-2 group-hover:text-primary transition-colors cursor-pointer" 
                            title={note.title}
                            onClick={onClick} // Ensure title click works
                        >
                            {note.title}
                        </h3>
                        
                        <p className="text-sm text-muted-foreground line-clamp-3"> {/* Keep line-clamp 3 */}
                            {summary}
                        </p>
                    </div>
                    
                    {/* Tags section (at bottom of content) */} 
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-auto pt-2"> {/* mt-auto pushes to bottom */}
                            {tags.slice(0, 5).map((tag: Tag) => ( // Show up to 5 tags
                                <Badge key={tag.id} variant="secondary" className="text-xs font-normal">
                                    <Tags className="h-3 w-3 mr-1" /> 
                                    {tag.name}
                                </Badge>
                            ))}
                            {tags.length > 5 && (
                                <Badge variant="secondary" className="text-xs font-normal">...</Badge>
                            )}
                        </div>
                    )}
                </CardContent>

                {/* NO CardFooter needed anymore */}
            </Card>
        </motion.div>
    );
};

export default NoteCard; 