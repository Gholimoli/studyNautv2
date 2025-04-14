import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <Header />
      {/* The main content area will grow to fill available space */}
      <main className="flex-1">
        {children} 
      </main>
      <Footer />
    </div>
  );
} 