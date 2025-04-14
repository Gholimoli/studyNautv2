import React from 'react';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools'; // Optional DevTools
import { router } from './router'; // Import router instance
import { Header } from '@/components/layout/Header'; // Import Header
import { Footer } from '@/components/layout/Footer'; // Import Footer

function App() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      <Header /> {/* Add Header */}
      <main className="flex-1 p-4 md:p-8">
        <Outlet /> {/* Render the matched route component here */}
      </main>
      <Footer /> {/* Add Footer */}
      
      {/* Optional Router DevTools - Use Vite env variable */}
      { import.meta.env.DEV && <TanStackRouterDevtools router={router} /> }
    </div>
  );
}

export default App;
