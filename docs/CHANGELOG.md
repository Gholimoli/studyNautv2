# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

*   Initial documentation structure in `/docs` directory.
*   `GET /api/notes` endpoint implementation (`server/src/core/routes/notes/getNotes.route.ts`) to fetch notes for the authenticated user.
*   `@server/*` path alias configuration in `server/tsconfig.json`.
*   Created `docs/` directory with initial documentation files (README, PRD, ARCHITECTURE, backend, frontend, database, job-pipeline, api-endpoints, setup, ui-guidelines, ai-prompts, troubleshooting, lessons-learned, CHANGELOG).
*   **Refactor:** Enforced <300 LOC per file (except orchestrator jobs), modularized ElevenLabs processor, and improved audio pipeline robustness. Extracted chunking/temp helpers to `elevenlabs.utils.ts`, refactored `elevenlabs.processor.ts` for orchestration-only logic, and standardized config/env usage and metadata access in `transcribeAudio.job.ts`.
*   Implemented full YouTube pipeline: users can submit YouTube URLs, transcripts are extracted, and notes are generated using Gemini (configurable via .env).
*   Added robust error handling and dynamic import for youtube-transcript.
*   Improved Gemini provider logging for easier debugging of large/complex jobs.
*   Visuals are now generated for YouTube notes as with other sources.
*   Model selection is now controlled via PRIMARY_AI_PROVIDER in .env.
*   Implemented and debugged Mistral OCR pipeline for both images and PDFs.
*   Fixed provider interface alignment and TypeScript errors.
*   Added robust logging and error handling for all OCR flows.
*   Confirmed end-to-end success for image and PDF OCR with Mistral as primary provider.
*   **Authentication System:**
    - Implemented user registration (`/api/auth/register`) and login (`/api/auth/login`) backend endpoints with password hashing (bcryptjs).
    - Created frontend `LoginPage.tsx` with forms for sign-in and sign-up using React Hook Form, Zod validation, and shadcn/ui Tabs.
    - Developed TanStack Query mutation hooks (`useLoginMutation`, `useRegisterMutation`, `useLogoutMutation`) in `useAuthMutations.ts` for handling auth API calls, cache invalidation, and redirects.
    - Implemented logout functionality (`/api/auth/logout`) accessible via a user dropdown menu in the `Header.tsx` component. Added `Avatar` component for user display.
    - Created `useAuthStatus` hook to fetch and cache user authentication status (`/api/auth/status`).
    - Implemented route protection for authenticated routes (`/`, `/notes`, etc.) using TanStack Router's `beforeLoad` property and an `ensureUserIsAuthenticated` check function in `router.tsx`.
    - Integrated `Toaster` component for user feedback on auth actions.
    - Refactored `queryClient` instantiation to `src/lib/query-client.ts` to resolve circular dependency with router setup.

### Changed

*   Refined the Express route handler signature in `getNotes.route.ts` to return `Promise<void>` and explicitly type `Response`.
*   Updated `server/tsconfig.json` to include the `@server/*` path alias pointing to `src/*`.
*   **Audio pipeline:** Improved error handling, logging, and modularity. Confirmed all server files are under 300 lines (except orchestrators). End-to-end audio upload, transcription, and note generation tested and working.

### Fixed

*   Resolved TypeScript module resolution errors for `@server/*` imports in the backend.
*   Corrected Express route handler return type linting errors.

### Removed

*   (None)

## [0.1.0] - YYYY-MM-DD

*   Initial project setup.
*   (Add details of initial commit/version here) 