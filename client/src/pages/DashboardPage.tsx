import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useSubmitTextMutation } from '@/hooks/useMediaMutations';
import { Input } from '@/components/ui/input';
import { useGetNotesQuery } from '@/hooks/useNotesQueries';
import { Link } from '@tanstack/react-router';
import { Skeleton } from "@/components/ui/skeleton"
import { AudioUploadForm } from "@/components/media/AudioUploadForm";

export function DashboardPage() {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const submitTextMutation = useSubmitTextMutation();
  const { data: notesData, isLoading: isLoadingNotes, isError: isErrorNotes, error: notesError } = useGetNotesQuery();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      // Basic validation: Prevent submitting empty text
      alert('Please enter some text to process.'); 
      return;
    }
    submitTextMutation.mutate({ text, ...(title && { title }) });
    // Optionally clear the form after submission
    // setText('');
    // setTitle('');
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-semibold mb-6">Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Text Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>Process New Text</CardTitle>
            <CardDescription>Paste your text below to generate notes.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="text-title">Title (Optional)</Label>
                <Input 
                  id="text-title"
                  placeholder="Enter a title for your notes"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  disabled={submitTextMutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="text-content">Text Content</Label>
                <Textarea 
                  id="text-content"
                  placeholder="Paste your text here..."
                  rows={10} 
                  required
                  value={text}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                  disabled={submitTextMutation.isPending}
                />
              </div>
              {submitTextMutation.isError && (
                <p className="text-sm text-destructive">
                  {submitTextMutation.error?.message || 'Error submitting text.'}
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={submitTextMutation.isPending}>
                {submitTextMutation.isPending ? 'Processing...' : 'Generate Notes'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Add after the text processing section, before recent notes */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Test Audio Pipeline</h2>
          <AudioUploadForm />
        </section>

        {/* Recent Notes List Card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Notes</CardTitle>
            <CardDescription>Your recently generated notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingNotes && (
              // Show skeletons while loading
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-4/5 rounded-md" />
              </div>
            )}
            {isErrorNotes && (
              <p className="text-sm text-destructive">
                Error loading notes: {notesError?.message || 'Unknown error'}
              </p>
            )}
            {notesData && notesData.notes.length === 0 && (
              <p className="text-muted-foreground">No recent notes yet. Process some text to get started!</p>
            )}
            {notesData && notesData.notes.length > 0 && (
              <ul className="space-y-3">
                {notesData.notes.slice(0, 5).map((note) => ( // Show top 5 recent notes
                  <li key={note.id} className="border p-3 rounded-md hover:bg-muted/50 transition-colors">
                    <Link 
                      to="/notes/$noteId" // Assuming this route exists or will be created
                      params={{ noteId: String(note.id) }} 
                      className="block"
                    >
                      <h3 className="font-medium text-primary truncate">{note.title || 'Untitled Note'}</h3>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(note.createdAt).toLocaleDateString()}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {notesData && notesData.total > 5 && (
               <div className="text-center mt-4">
                 <Link to="/notes" className="text-sm text-primary hover:underline">View all notes ({notesData.total})</Link>
               </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 