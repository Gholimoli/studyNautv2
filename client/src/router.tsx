import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import App from './App'; // Main App layout with Header/Sidebar
import { QueryClient } from '@tanstack/react-query'; // Import QueryClient
import axios from 'axios'; // Import axios for isAxiosError

// Import Page Components
import LoginPage from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NoteDetailPage } from '@/pages/NoteDetailPage';
import { NotesIndexPage } from '@/pages/NotesIndexPage'; // Import the new page component

// Import the new pipeline component
import { TextPipelineInput } from '@/components/pipelines/TextPipelineInput';

// Import Auth Status hook
import { useAuthStatus } from '@/hooks/useAuthStatus'; // Adjust path if needed

// Import queryClient from the new dedicated file
import { queryClient } from '@/lib/query-client'; // UPDATED IMPORT PATH

// --- Auth Check Logic --- 
async function ensureUserIsAuthenticated() {
  console.log("[ensureUserIsAuthenticated] Starting check..."); // Log start
  try {
    // Fetch auth status using the queryClient directly
    const authData = await queryClient.fetchQuery({
      queryKey: ['authStatus'],
      queryFn: async () => {
        console.log("[ensureUserIsAuthenticated] Fetching /api/auth/status...");
        try {
          const { apiClient } = await import('@/lib/api-client');
          const res = await apiClient.get('/auth/status');
          console.log("[ensureUserIsAuthenticated] Received status data:", res.data);
          return res.data;
        } catch (error: any) { // Catch errors during the API call
            // Check if it's an Axios error and specifically a 401
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                console.warn("[ensureUserIsAuthenticated] API returned 401 during status fetch. Treating as unauthenticated.");
                return { authenticated: false, user: null }; // Return unauthenticated status
            } else {
                // For other errors during fetch, re-throw them to be caught by the outer catch
                console.error("[ensureUserIsAuthenticated] Non-401 error during status fetch:", error);
                throw error; 
            }
        }
      },
      staleTime: 1000 * 10, // Cache for 10 seconds during load check
      retry: false
    });

    console.log("[ensureUserIsAuthenticated] Auth Data from fetchQuery:", authData);

    if (!authData?.authenticated) {
      console.warn("[ensureUserIsAuthenticated] User NOT authenticated. Redirecting to /login...");
      throw redirect({
        to: '/login',
      });
    } else {
      console.log("[ensureUserIsAuthenticated] User IS authenticated. Proceeding."); // Log success
    }
    // User is authenticated, proceed
  } catch (error) {
      // Check if it's a redirect error, which is expected
      if (error instanceof Error && typeof (error as any).redirect === 'object') {
          console.log("[ensureUserIsAuthenticated] Redirecting...");
          throw error; // Re-throw the redirect
      } else {
          // Log unexpected errors during the check
          console.error("[ensureUserIsAuthenticated] Unexpected error during auth check:", error);
          // Optionally, redirect to login even on unexpected errors
          // console.warn("[ensureUserIsAuthenticated] Unexpected error, redirecting to /login as fallback.");
          // throw redirect({ to: '/login' });
          throw error; // Re-throw other errors to potentially be caught by router error handling
      }
  }
}

// --- Define Routes under a SINGLE Root --- 

const rootRoute = createRootRoute({
    // Use App component which likely contains the main layout (Header, Sidebar) and the <Outlet /> for child routes
    // Try defining component inline as a diagnostic step
    component: () => <App />,
});

// Login route (doesn't use the main App layout typically, but might if App handles conditional layout)
const loginRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  // Consider adding logic in App or here to hide Header/Sidebar for /login
});

// Register route
const registerRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
  // Consider adding logic in App or here to hide Header/Sidebar for /register
});

// Dashboard route (root path) - Protected
const dashboardRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/', 
  component: DashboardPage,
  beforeLoad: ensureUserIsAuthenticated, // Corrected property name
}); 

// Notes list route - Protected
const notesIndexRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/notes', 
  component: NotesIndexPage, 
  beforeLoad: ensureUserIsAuthenticated, // Corrected property name
});

// Notes favorites route - Protected
const notesFavoritesRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/notes/favorites', 
  component: NotesIndexPage, // Reuse the same component
  beforeLoad: ensureUserIsAuthenticated,
});

// Note detail route - Protected
const noteDetailRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/notes/$noteId', 
  component: NoteDetailPage, 
  beforeLoad: ensureUserIsAuthenticated, // Corrected property name
});

// Folder detail route - Protected
const folderDetailRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/folders/$folderId', // Use $ for path parameters
  component: NotesIndexPage, // Reuse the same component
  beforeLoad: ensureUserIsAuthenticated,
});

// Text Pipeline route - Protected
const textPipelineRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/pipelines/text',
  component: TextPipelineInput, // Use the imported component
  beforeLoad: ensureUserIsAuthenticated,
});

// --- Build Route Tree --- 
// Add all defined routes as children of the single rootRoute
const routeTree = rootRoute.addChildren([
  dashboardRoute, // Path: '/'
  loginRoute,     // Path: '/login'
  registerRoute,  // Path: '/register'
  notesIndexRoute,// Path: '/notes'
  notesFavoritesRoute, // Path: '/notes/favorites'
  noteDetailRoute, // Path: '/notes/$noteId'
  folderDetailRoute, // Path: '/folders/$folderId'
  textPipelineRoute // Path: '/pipelines/text'
]);

// Create the router instance
export const router = createRouter({ 
  routeTree, 
  context: { queryClient }, // Provide queryClient to context if needed elsewhere
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
} 

/* 
Simplified structure with a single root route. 
The App component is responsible for rendering the main layout and the Outlet for child routes.
Authentication routes (/login, /register) are also children but might need conditional layout handling within App.tsx.
*/ 