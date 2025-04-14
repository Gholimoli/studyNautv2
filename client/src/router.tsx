import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import App from './App'; // Assuming App.tsx is the root layout

// Import Page Components
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage'; // Import the new DashboardPage
import { NoteDetailPage } from '@/pages/NoteDetailPage'; // Import the new component

// Placeholder Page Components (Will replace or create)
// function DashboardPage() { return <div>Dashboard Page (Protected)</div>; } // Remove placeholder
function IndexPage() { return <div>Home/Index Page</div>; }
function NotesIndexPage() { return <div>Notes List Page</div>; } // Placeholder
// Remove inline NoteDetailPage placeholder
// function NoteDetailPage({ params }: { params: { noteId: string }}) { 
//   return <div>Note Detail Page for ID: {params.noteId}</div>; 
// } 

// Create a root route
const rootRoute = createRootRoute({
  component: App,
});

// Create child routes
const indexRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage, 
});

const loginRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

const dashboardRoute = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage, // Use the imported DashboardPage component
  // TODO: Add authentication check here later (loader or beforeLoad)
});

// Add Notes Routes
const notesIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes',
  component: NotesIndexPage, // Use placeholder
  // TODO: Auth check
});

const noteDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes/$noteId',
  component: NoteDetailPage, // Use the imported component
  // TODO: Auth check + Loader to fetch note data
});

// Combine routes into a route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  dashboardRoute,
  notesIndexRoute, // Add new route
  noteDetailRoute,  // Add new route
]);

// Create the router instance
export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
} 