import React from 'react';

export function Footer() {
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t border-border/40">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built by YourName/Team. The source code is available on GitHub. {/* TODO: Add link */}
        </p>
         {/* Can add social links or other footer content here */}
      </div>
    </footer>
  );
} 