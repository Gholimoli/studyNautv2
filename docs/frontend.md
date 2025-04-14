# Frontend Architecture (`client/`)

This document outlines the architecture of the Studynaut frontend client application.

## Overview

The frontend is a single-page application (SPA) built using React, Vite, and TypeScript. It provides the user interface for interacting with Studynaut, allowing users to manage sources, view notes, use study tools, and manage their profile.

## Key Technologies

*   **Framework/Library:** React 18+
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Routing:** TanStack Router
*   **Data Fetching & State:** TanStack Query (for server state), Zustand (optional, for complex global client state), React Context/Hooks (for local/scoped state)
*   **UI Components:** shadcn/ui (built on Radix UI & Tailwind CSS)
*   **Styling:** Tailwind CSS v4
*   **Forms:** React Hook Form (recommended for complex forms)
*   **Animation:** Framer Motion
*   **Linting/Formatting:** ESLint, Prettier

## Directory Structure (`client/src`)

```
src/
├── assets/             # Static assets (images, fonts)
├── components/
│   ├── ui/             # Re-exported shadcn/ui base components
│   ├── layout/         # Layout components (Header, Footer, Sidebar, PageWrapper)
│   ├── common/         # General reusable components (Loaders, ErrorDisplays)
│   ├── features/       # Feature-specific components (e.g., notes/, media/, auth/)
│   └── HOC/            # Higher-Order Components (e.g., AuthGuard)
├── config/             # Application configuration (API URLs, constants)
├── hooks/              # Custom React hooks (e.g., useAuth, useDebounce)
├── lib/
│   ├── api/            # API client setup (e.g., Axios instance, API endpoint functions)
│   ├── query/          # TanStack Query client setup, query keys
│   ├── utils/          # General utility functions (formatting, validation)
│   └── validators/     # Zod schemas for client-side validation
├── pages/              # Top-level route components (Deprecated if using file-based routing)
├── routes/             # TanStack Router route definitions (file-based)
│   ├── __root.tsx      # Root layout route
│   ├── index.tsx       # Home page route
│   ├── notes/
│   │   ├── index.tsx     # Notes list page
│   │   └── $noteId.tsx   # Note detail page
│   ├── auth/
│   │   └── login.tsx     # Login page
│   └── (other routes...)
├── services/           # (Optional) Abstraction layer for complex API interactions
├── store/              # Zustand store definitions (if used)
├── styles/             # Global styles, Tailwind configuration base
├── types/              # Application-wide TypeScript types/interfaces
├── App.tsx             # Main application component (renders RouterProvider)
└── main.tsx            # Application entry point (renders App)
```

*Note: With TanStack Router's file-based routing, the `pages/` directory might be replaced by structuring components directly within the `routes/` directory.*)

## Core Concepts

1.  **Component-Based:** The UI is built as a tree of reusable React components.
2.  **Routing:** TanStack Router handles navigation, URL parameters, and route loading states. File-based routing is preferred for organization.
3.  **State Management:**
    *   **Server State:** TanStack Query is the primary tool for fetching, caching, synchronizing, and updating server data. It handles loading states, error states, and background refetching.
    *   **Client State:** Simple state is managed locally within components using `useState` or `useReducer`. Shared, cross-component client state can be managed using React Context for simple cases, or Zustand for more complex global state needs.
    *   **Form State:** React Hook Form is recommended for managing form inputs, validation, and submission states.
4.  **Data Fetching:** API calls are encapsulated in functions (e.g., in `lib/api/`) and integrated with TanStack Query `useQuery` and `useMutation` hooks.
5.  **Styling:** Tailwind CSS utility classes are used directly in components for styling. shadcn/ui provides pre-built, customizable components styled with Tailwind.
6.  **Type Safety:** TypeScript is used throughout for static typing, enhancing code reliability and maintainability. Shared types with the backend might reside in a separate `shared` package within the monorepo.

## Data Flow Example (Fetching Notes)

1.  User navigates to the notes list page (`/notes`).
2.  The route component (e.g., `routes/notes/index.tsx`) renders.
3.  Inside the component, `useQuery` hook (from TanStack Query) is called with a specific query key (e.g., `['notes', filters]`) and a fetch function (e.g., `api.getNotes(filters)`).
4.  **TanStack Query:**
    *   Checks its cache for data associated with the query key.
    *   If cached data exists and is not stale, returns it immediately.
    *   If data is stale or not cached, calls the fetch function (`api.getNotes`).
5.  **Fetch Function (`lib/api/notes.ts`):**
    *   Uses an HTTP client (e.g., Axios) to make a `GET /api/notes` request to the backend.
    *   Returns the promise from the HTTP client.
6.  **TanStack Query:**
    *   Manages the promise resolution.
    *   Updates its cache with the fetched data.
    *   Provides status flags (`isLoading`, `isError`, `isSuccess`) and the fetched `data` or `error` to the component.
7.  **Component:** Re-renders based on the state provided by `useQuery`:
    *   Shows a loading indicator if `isLoading`.
    *   Shows an error message if `isError`.
    *   Renders the list of notes using the `data` if `isSuccess`.

## Key Component Types

*   **UI Components (`components/ui/`):** Base building blocks from shadcn/ui (Button, Input, Card, etc.).
*   **Layout Components (`components/layout/`):** Define the overall page structure (Header, Footer, Sidebar, PageWrapper).
*   **Common Components (`components/common/`):** Application-wide reusable elements not tied to a specific feature (LoadingSpinner, ErrorDisplay, Logo).
*   **Feature Components (`components/features/*/`):** Components specific to a particular feature domain (NoteCard, MediaUploadForm, AuthForm).
*   **Route Components (`routes/**/*.tsx`):** Components directly mapped to application routes, responsible for orchestrating data fetching and rendering feature components.

## Styling Approach

*   Primarily use Tailwind utility classes directly in JSX.
*   Leverage `clsx` or `cn` utility for conditional class names.
*   Use shadcn/ui component variants for consistency.
*   Define custom CSS or Tailwind theme extensions in `styles/` only when necessary for global styles or complex overrides.

## Error Handling

*   TanStack Query's `isError` and `error` properties handle API request errors.
*   Dedicated `ErrorDisplay` components show user-friendly messages.
*   Client-side validation errors (e.g., from React Hook Form) are shown inline with form fields.
*   Global error boundaries can catch unexpected rendering errors. 