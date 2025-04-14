import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useUploadFileMutation } from '@/hooks/useMediaMutations';

export function AudioUploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [languageCode, setLanguageCode] = useState(''); // Optional language
  const uploadMutation = useUploadFileMutation();
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref to reset file input

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      alert('Please select an audio file to upload.');
      return;
    }

    uploadMutation.mutate(
      { file: selectedFile, type: 'AUDIO', languageCode },
      {
        onSuccess: () => {
          // Reset form on success
          setSelectedFile(null);
          setLanguageCode('');
          if (fileInputRef.current) {
            fileInputRef.current.value = ''; 
          }
        },
        // onError is handled globally by the hook
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Audio File</CardTitle>
        <CardDescription>Upload an audio file for transcription and notes.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="audio-file">Audio File</Label>
            <Input 
              id="audio-file"
              type="file"
              accept="audio/*" // Accept common audio types
              required
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
            />
             {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </p>
              )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="language-code">Language Code (Optional)</Label>
            <Input 
              id="language-code"
              placeholder="e.g., en, es, fr (defaults to detection)"
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              disabled={uploadMutation.isPending}
            />
          </div>
          {uploadMutation.isError && (
            <p className="text-sm text-destructive">
              {uploadMutation.error?.message || 'Error uploading file.'}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={uploadMutation.isPending || !selectedFile}>
            {uploadMutation.isPending ? 'Uploading...' : 'Upload & Process Audio'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 