import { QueryClient } from '@tanstack/react-query';

// Create and export the QueryClient instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Configure global query options if needed
      // staleTime: 1000 * 60 * 5, // e.g., 5 minutes
      retry: 1, // Default retry attempts
    },
  },
}); 