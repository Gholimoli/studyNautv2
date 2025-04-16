import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import App from './App'; // Main App layout with Header/Sidebar

// Import Page Components
// import { LoginPage } from '@/pages/LoginPage'; // Remove old import
import LoginPage from '@/pages/auth/LoginPage'; // Import the NEW styled LoginPage
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

// --- Root Routes --- 

// 1. Root for main application layout (uses App with Header/Sidebar)
const appRootRoute = createRootRoute({
  component: App, 
});

// 2. Root for authentication pages (renders outlet directly, no main layout)
const authRootRoute = createRootRoute({
    component: () => (
        // Simple component that just renders the matched auth route
        <Outlet />
    ),
});

// --- Authentication Routes (Children of authRootRoute) ---

const loginRoute = createRoute({ 
  getParentRoute: () => authRootRoute, // Parent is the AUTH root
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({ 
  getParentRoute: () => authRootRoute, // Parent is the AUTH root
  path: '/register',
  component: RegisterPage, // Make sure RegisterPage exists and is styled similarly
});

// --- Main Application Routes (Children of appRootRoute) ---

const indexRoute = createRoute({ 
  getParentRoute: () => appRootRoute, // Parent is the APP root
  path: '/',
  component: IndexPage, // Or redirect logic
});

const dashboardRoute = createRoute({ 
  getParentRoute: () => appRootRoute, // Parent is the APP root
  path: '/dashboard',
  component: DashboardPage,
  // TODO: Add authentication check
});

const notesIndexRoute = createRoute({
  getParentRoute: () => appRootRoute, // Parent is the APP root
  path: '/notes',
  component: NotesIndexPage,
  // TODO: Auth check
});

const noteDetailRoute = createRoute({
  getParentRoute: () => appRootRoute, // Parent is the APP root
  path: '/notes/$noteId',
  component: NoteDetailPage,
  // TODO: Auth check + Loader
});


// --- Route Trees --- 
// Note: TanStack Router typically expects ONE root route in the tree.
// We might need a different approach if multiple top-level roots aren't directly supported.
// A common pattern is one absolute root, and conditional layouts within child routes or the App component itself.

// Let's try combining under ONE root but using different Outlet contexts if needed, or restructure.
// For now, let's revert to a single root and see if the issue persists after checking CSS import.

// --- REVERTING TO SINGLE ROOT for simplicity --- 

const rootRoute = createRootRoute({
    // We need a component here that can conditionally render the layout
    // or render Outlet directly based on the route.
    // For now, let's use App and assume App might handle this later.
    component: App,
});

const loginRouteSingleRoot = createRoute({ 
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

// ... other routes defined similarly as children of rootRoute ...
// Define other routes like index, register, dashboard etc. as before,
// all children of the single rootRoute

const indexRouteSingleRoot = createRoute({ getParentRoute: () => rootRoute, path: '/', component: IndexPage });
const registerRouteSingleRoot = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: RegisterPage });
const dashboardRouteSingleRoot = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: DashboardPage });
const notesIndexRouteSingleRoot = createRoute({ getParentRoute: () => rootRoute, path: '/notes', component: NotesIndexPage });
const noteDetailRouteSingleRoot = createRoute({ getParentRoute: () => rootRoute, path: '/notes/$noteId', component: NoteDetailPage });

// Combine routes into a single tree
const routeTree = rootRoute.addChildren([
  indexRouteSingleRoot,
  loginRouteSingleRoot, 
  registerRouteSingleRoot,
  dashboardRouteSingleRoot,
  notesIndexRouteSingleRoot,
  noteDetailRouteSingleRoot,
]);

// Create the router instance
export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
} 

/* 
NOTE: The initial thought of separate root routes might be complex with TanStack Router's typical setup.
The most common issue for missing styles is the CSS import. Let's ensure that's correct first.
If client/src/main.tsx imports client/src/index.css, the styles *should* apply globally.
The rendering issue might be more subtle if the CSS is indeed loaded.
*/ 