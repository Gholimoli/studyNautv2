import React from 'react';
import { useParams } from '@tanstack/react-router';
import { useGetNoteByIdQuery } from '@/hooks/useNotesQueries'; // Import the new hook
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from 'react-markdown'; // Import the renderer
import remarkGfm from 'remark-gfm'; // Import the GFM plugin

// Remove the explicit props interface, as we'll use the hook
// interface NoteDetailPageProps {
//   params: {
//     noteId: string;
//   };
// }

// The component doesn't need to accept params directly as props anymore
export function NoteDetailPage() {
  // Use the hook to get route parameters
  // Ensure the path definition in router.tsx uses $noteId for this key
  const { noteId } = useParams({ from: '/notes/$noteId' });
  // Fetch the note data using the hook
  const { data: note, isLoading, isError, error } = useGetNoteByIdQuery(noteId);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4 rounded-md" /> {/* Title Skeleton */}
          <Skeleton className="h-8 w-1/2 rounded-md" /> {/* Subtitle/Meta Skeleton */}
          <Skeleton className="h-64 w-full rounded-md" /> {/* Content Skeleton */}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Could not load the note details. Please try again later.</p>
            <p className="text-sm text-muted-foreground mt-2">Error: {error?.message || 'Unknown error'}</p>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {note && (
        <article className="prose dark:prose-invert max-w-none">
          <h1>{note.title || 'Untitled Note'}</h1>
          <p className="text-sm text-muted-foreground">
            Created: {new Date(note.createdAt).toLocaleDateString()}
          </p>
          <div className="mt-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {note.markdownContent || 'No content available.'}
            </ReactMarkdown>
          </div>
        </article>
      )}
    </div>
  );
} 