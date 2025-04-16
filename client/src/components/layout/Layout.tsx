import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/20"> {/* Slightly different bg for content area */}
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout; 