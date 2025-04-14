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

### Changed

*   Refined the Express route handler signature in `getNotes.route.ts` to return `Promise<void>` and explicitly type `Response`.
*   Updated `server/tsconfig.json` to include the `@server/*` path alias pointing to `src/*`.

### Fixed

*   Resolved TypeScript module resolution errors for `@server/*` imports in the backend.
*   Corrected Express route handler return type linting errors.

### Removed

*   (None)

## [0.1.0] - YYYY-MM-DD

*   Initial project setup.
*   (Add details of initial commit/version here) 