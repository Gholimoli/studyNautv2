import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Adjust path
import { Button } from '@/components/ui/button'; // Adjust path
import { cn } from '@/lib/utils'; // Adjust path

interface AiTutorCardProps {
  onStartLearning?: () => void;
  className?: string;
}

export function AiTutorCard({ onStartLearning, className }: AiTutorCardProps) {
  return (
    <Card className={cn('bg-primary/10 border-primary/20', className)}> {/* Subtle primary background */}
      <CardHeader>
        <CardTitle className="text-lg font-semibold">AI Tutor</CardTitle>
        <CardDescription className="text-sm text-primary/80"> {/* Slightly darker description */}
          Get personalized help with your studies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Chat with our AI tutor to get explanations, examples, and guidance on any topic.
        </p>
        <Button className="w-full" onClick={onStartLearning}>
          Start Learning
        </Button>
      </CardContent>
    </Card>
  );
} 