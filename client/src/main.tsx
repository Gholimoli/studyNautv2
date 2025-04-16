import React from 'react'
import ReactDOM from 'react-dom/client'
// import App from './App.tsx' // App is now the root route component
import './index.css'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router' // Import the router instance
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'; // Import from the new file
import { ReactQueryDevtools } from '@tanstack/react-query-devtools' // Optional DevTools

// // Create a client - REMOVED
// export const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       // Configure global query options if needed
//       // staleTime: 1000 * 60 * 5, // e.g., 5 minutes
//       retry: 1, // Default retry attempts
//     },
//   },
// });

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) { // Ensure root is not already rendered (for HMR)
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {/* Optional Query DevTools */} 
        { import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} /> }
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

