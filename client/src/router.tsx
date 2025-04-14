import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import App from './App'; // Assuming App.tsx is the root layout

// Import Page Components
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

// Placeholder Page Components (Will replace or create)
function DashboardPage() { return <div>Dashboard Page (Protected)</div>; }
function IndexPage() { return <div>Home/Index Page</div>; }

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
  component: DashboardPage,
  // TODO: Add authentication check here later (loader or beforeLoad)
});

// Combine routes into a route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  dashboardRoute,
]);

// Create the router instance
export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
} 