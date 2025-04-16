import React from 'react';
import { Link } from '@tanstack/react-router'; // Use TanStack Router Link
import { Card, CardContent } from '@/components/ui/card'; // Adjust path
import { cn } from '@/lib/utils'; // Adjust path
// TODO: Add Badge component from shadcn/ui (`pnpm dlx shadcn-ui@latest add badge`)
// import { Badge } from '@/components/ui/badge'; // Commented out import again

// Interface matching the snippet's data structure more closely
interface Note {
  id: string | number;
  title: string;
  excerpt: string; // Renamed from snippet
  category?: string; // Renamed from tag
  date: string; // Or Date object
  // favorite?: boolean; // Removed if not in snippet data
}

interface NoteCardProps {
  note: Note;
  className?: string;
  // onSelectNote removed as snippet uses Link directly
}

export function NoteCard({ note, className }: NoteCardProps) {
  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md', // Simplified base classes
        className
      )}
    >
      {/* Link wraps the entire content for clickability */}
      <Link to="/notes/$noteId" params={{ noteId: String(note.id) }} className="block">
        <CardContent className="p-4"> {/* Adjusted padding */}
          <div className="flex justify-between items-start gap-4 mb-3"> {/* Top section for title/date */}
            <h3 className="font-medium text-base text-foreground line-clamp-2">{note.title}</h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {note.date}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3"> {/* Excerpt */}
            {note.excerpt}
          </p>
          {/* Category Tag/Badge */} 
          {note.category && (
             <span className="inline-block text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
               {note.category}
             </span>
            /* TODO: Replace span with Badge component once added
            <Badge variant="secondary" className="text-xs font-medium">
              {note.category}
            </Badge>
            */
          )}
        </CardContent>
      </Link>
    </Card>
  );
} 