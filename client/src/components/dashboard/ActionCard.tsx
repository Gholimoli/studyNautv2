import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Adjust path
import { cn } from '@/lib/utils'; // Adjust path

// TODO: Install an icon library like lucide-react
// import { IconType } from 'lucide-react'; // Example

interface ActionCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  layout?: 'centered' | 'horizontal'; // New layout prop
}

export function ActionCard({
  title,
  description,
  icon,
  onClick,
  className,
  layout = 'centered', // Default to centered
}: ActionCardProps) {
  const isHorizontal = layout === 'horizontal';

  return (
    <Card
      className={cn(
        'cursor-pointer transition-shadow hover:shadow-md h-full', // Added h-full for consistent height in grid
        isHorizontal ? 'flex items-center p-4' : 'text-center',
        className
      )}
      onClick={onClick}
    >
      {/* Conditional rendering/styling based on layout */}
      {isHorizontal ? (
        // Horizontal Layout
        <>
          {icon && (
            <div className="mr-4 flex-shrink-0 text-foreground"> {/* Use foreground color for horizontal icons */}
              {/* Icon directly, no extra background needed for horizontal based on screenshot */}
              {icon} 
            </div>
          )}
          <div className="flex-grow">
            <CardTitle className="text-base font-semibold mb-1">{title}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {description}
            </CardDescription>
          </div>
        </>
      ) : (
        // Centered Layout
        <>
          <CardHeader className="items-center pb-4"> {/* Increased pb slightly */}
            {icon && (
              // Using muted background, ensure icon size is consistent via parent
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"> 
                 {/* Icon color will be inherited or set directly in DashboardPage */}
                 <div className="text-primary">{icon}</div>
              </div>
            )}
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </CardHeader>
          <CardContent className="pb-4"> {/* Added pb */}
            <CardDescription className="text-sm text-muted-foreground">
              {description}
            </CardDescription>
          </CardContent>
        </>
      )}
    </Card>
  );
} 