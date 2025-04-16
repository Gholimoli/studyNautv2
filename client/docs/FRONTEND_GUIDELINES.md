# Frontend Development Guidelines

**Version:** 1.0
**Date:** 2025-08-26

This document outlines the conventions, architecture, and best practices for developing the frontend client application for Studynaut.

## 1. Technology Stack

*   **Framework:** React (^19.1.0)
*   **Build Tool:** Vite (^5.3.5)
*   **Styling:** Tailwind CSS (^3.4.17)
    *   CSS Variables defined in `src/index.css`.
    *   Utility Classes for most styling.
    *   `clsx` and `tailwind-merge` for conditional/merged classes.
    *   `tailwindcss-animate` plugin.
*   **UI Components:** shadcn/ui (using Radix UI primitives)
*   **Routing:** TanStack Router (^1.116.0)
*   **State Management:**
    *   Server State: TanStack Query (^5.74.0)
    *   Client State: React Hooks (`useState`, `useReducer`, etc.)
*   **API Client:** Axios (^1.8.4)
*   **Schema Validation:** Zod (^3.24.2) (Primarily for forms/API data)
*   **Forms:** React Hook Form (^7.55.0)
*   **Language:** TypeScript (^5.8.3)
*   **Package Manager:** pnpm

## 2. Folder Structure

The `client/src` directory is organized as follows:

*   `assets/`: Static assets like images, fonts (if any).
*   `components/`: Reusable UI components.
    *   `ui/`: Base shadcn/ui components (e.g., `Button`, `Input`).
    *   `layout/`: Components defining page structure (e.g., `Header`, `Sidebar`, `Layout`).
    *   Feature-specific subdirectories (e.g., `notes/`, `auth/`) for components related to a specific domain.
*   `contexts/`: React context providers (if any).
*   `hooks/`: Custom React hooks for reusable logic.
*   `lib/`: Utility functions, helper modules, API client setup.
    *   `utils.ts`: General utility functions (uses `clsx`, `tailwind-merge`).
    *   `api.ts`: Axios instance configuration and potentially API function wrappers.
*   `pages/`: Components representing application pages/views, mapped by the router.
*   `App.tsx`: Root application component, often wrapping layout and routing context.
*   `index.css`: Global styles, Tailwind directives (`@tailwind base/components/utilities`), and custom CSS variable definitions (`:root`, `.dark`).
*   `main.tsx`: Main entry point for the React application, renders the root component and sets up providers (React Query, Router).
*   `router.tsx`: Defines application routes using TanStack Router.

## 3. Naming Conventions

*   **Directories:** `kebab-case` (e.g., `note-detail`, `auth-forms`)
*   **Component Files:** `PascalCase.tsx` (e.g., `UserProfile.tsx`, `NoteCard.tsx`)
*   **Hook Files:** `useCamelCase.ts` (e.g., `useAuthStatus.ts`)
*   **Utility/Service Files:** `camelCase.ts` (e.g., `apiClient.ts`, `dateUtils.ts`)
*   **Variables/Functions:** `camelCase`
*   **Types/Interfaces:** `PascalCase`
*   **CSS Variables:** `--kebab-case` (defined in `index.css`)

## 4. Component Structure

Follow this general structure within component files (`.tsx`):

1.  **Imports:** Group imports (React, libraries, local components, types, assets).
2.  **Component Definition:** The main exported component function (usually using arrow function syntax).
3.  **(Optional) Types/Interfaces:** Define prop types and other local types specific to the component.
4.  **(Optional) Sub-components/Hooks:** Define smaller, related components or custom hooks used only within this file.
5.  **(Optional) Constants:** Define static content or constants used by the component.

```tsx
// 1. Imports
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Example import for class merging

// 3. Types/Interfaces
interface MyComponentProps {
  title: string;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
}

// 2. Component Definition
function MyComponent({ title, variant = 'primary', onClick }: MyComponentProps) {
  // 4. Hooks (Example)
  const [isActive, setIsActive] = useState(false);

  // 5. Constants (Example)
  const BUTTON_TEXT = 'Submit';

  const buttonClasses = cn(
    'base-button-class',
    { 'variant-primary': variant === 'primary' },
    { 'variant-secondary': variant === 'secondary' },
    { 'is-active': isActive }
  );

  return (
    <div>
      <h2>{title}</h2>
      <Button className={buttonClasses} onClick={onClick}>
        {BUTTON_TEXT}
      </Button>
    </div>
  );
}

export default MyComponent;
```

## 5. Styling

*   **Primary Method:** Use Tailwind CSS v3 utility classes directly in JSX.
*   **Base Styles & Variables:** Define global base styles and CSS variables (primarily for colors, radius, etc., following shadcn/ui conventions) in `src/index.css` within the `@layer base` block (`:root` and `.dark`).
*   **Custom Components:** Style custom components primarily using Tailwind utilities. Avoid writing extensive custom CSS files.
*   **Conditional Classes:** Use `clsx` and `tailwind-merge` (via the `cn` utility function likely in `lib/utils.ts`) for combining and overriding classes conditionally.
*   **No `@apply`:** Avoid using `@apply` in CSS files; prefer utility classes in components.

## 6. State Management

*   **Server Cache/Remote State:** Use **TanStack Query** for fetching, caching, synchronizing, and updating server state. Define query keys and query/mutation functions appropriately.
*   **UI/Local State:** Use standard React hooks (`useState`, `useReducer`) for component-level state (e.g., form inputs, toggles, modal visibility).
*   **Global Client State:** Avoid complex global client state managers unless absolutely necessary. If needed, Zustand would be the preferred choice, but evaluate simpler alternatives first (React Context, prop drilling for shallow trees).

## 7. Routing

*   Routing is managed by **TanStack Router**.
*   Route definitions are centralized in `src/router.tsx`.
*   Pages components are typically located in `src/pages/`.
*   Use TanStack Router's hooks (`useNavigate`, `useParams`, `useSearch`, etc.) for navigation and accessing route parameters.

## 8. API Interaction

*   API calls are made using an **Axios** instance, likely configured in `src/lib/api.ts` or similar.
*   Data fetching and mutation logic should primarily be encapsulated within **TanStack Query** hooks (`useQuery`, `useMutation`).

## 9. Linting and Formatting

*   **ESLint** and **TypeScript ESLint** are configured for code quality and consistency.
*   Adhere to the configured rules.
*   (Assumed) Prettier or a similar formatter should be used for consistent code style.

## 10. Documentation Best Practices (JSDoc)

*   Use JSDoc comments for exported functions, components, hooks, and complex logic.
*   **Components:** Document props (`@param` or `@prop`), purpose, and usage examples.
*   **Hooks:** Document parameters (`@param`), return value (`@returns`), and purpose.
*   **Utilities:** Document parameters (`@param`), return value (`@returns`), and purpose.

```typescript
/**
 * Formats a date object into a specific string format.
 * @param date - The date object to format.
 * @param formatString - The desired output format string (e.g., 'yyyy-MM-dd').
 * @returns The formatted date string.
 */
export function formatDate(date: Date, formatString: string): string {
  // ... implementation ...
}
``` 