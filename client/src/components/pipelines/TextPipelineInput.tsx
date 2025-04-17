import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from '@/lib/api-client';
import type { AppError } from '@/types/errors';

const MAX_CHARS = 100000;

interface TextSubmitPayload {
  text: string;
  title?: string;
}

interface TextSubmitResponse {
  sourceId: number;
  message: string;
}

export function TextPipelineInput() {
  const [text, setText] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const textMutation = useMutation<TextSubmitResponse, AppError, TextSubmitPayload>({
    mutationFn: (payload) => apiClient.post('/media/text', payload),
    onSuccess: (data) => {
      toast({
        title: "Processing Started",
        description: data.message || "Your text is being processed.",
        variant: "default",
      });
      navigate({ to: '/' });
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    textMutation.mutate({ text });
  };

  const charsRemaining = MAX_CHARS - text.length;
  const canSubmit = text.length > 0 && text.length <= MAX_CHARS && !textMutation.isPending;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Notes from Text</CardTitle>
        <CardDescription>
          Paste your text below (e.g., article content, notes, or any text you want to process).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full gap-2">
          <Label htmlFor="text-input">Your Text</Label>
          <Textarea
            id="text-input"
            placeholder="Paste your text here..."
            value={text}
            onChange={handleTextChange}
            maxLength={MAX_CHARS}
            className="min-h-[250px] text-base"
            rows={10}
            disabled={textMutation.isPending}
          />
          <p className="text-sm text-muted-foreground text-right">
            {charsRemaining >= 0 ? `${charsRemaining.toLocaleString()} characters remaining` : 'Character limit exceeded'}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {textMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {textMutation.isPending ? 'Processing...' : 'Generate Notes'}
        </Button>
      </CardFooter>
    </Card>
  );
} 