import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useRouterState } from '@tanstack/react-router';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  
  const isAuthRoute = ['/login', '/register'].includes(pathname);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {!isAuthRoute && <Sidebar />}

      <div className={`flex-1 flex flex-col overflow-hidden ${isAuthRoute ? 'w-full' : ''}`}>
        {!isAuthRoute && <Header />}

        <main className={`flex-1 overflow-y-auto ${isAuthRoute ? 'p-0' : 'p-6 md:p-8'} ${isAuthRoute ? 'bg-background' : 'bg-muted/20'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout; 