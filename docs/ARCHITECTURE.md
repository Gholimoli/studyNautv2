# Architecture Overview

This document provides a high-level overview of the Studynaut application's architecture.

## Core Components

Studynaut is built using a modern web stack, separating concerns into distinct parts:

1.  **Frontend Client (`client/`):** A React single-page application (SPA) built with Vite and TypeScript. It handles the user interface, interacts with the backend API, and uses TanStack Query for managing server state.
2.  **Backend API Server (`server/`):** A Node.js application using Express and TypeScript. It provides a RESTful API for the frontend, handles user authentication, interacts with the database (via Drizzle ORM), and enqueues background jobs.
3.  **Background Worker (`server/src/worker.ts`):** A separate Node.js process managed by BullMQ. It consumes jobs from a Redis queue to perform long-running tasks like content processing, AI analysis, and transcription, ensuring the API server remains responsive.
4.  **Database:** A PostgreSQL database storing user data, notes, source materials, and processing metadata. Drizzle ORM is used for type-safe database interactions and schema management.
5.  **Job Queue:** Redis is used by BullMQ to manage the queue of background jobs.

## Key Technologies

*   **Frontend:** React, Vite, TypeScript, TanStack Query, TanStack Router, Tailwind CSS, shadcn/ui
*   **Backend:** Node.js, Express, TypeScript, Drizzle ORM, Zod, Passport.js, bcryptjs
*   **Job Queue:** BullMQ, Redis
*   **Database:** PostgreSQL
*   **AI Providers:** Google Gemini API (primary), OpenAI API (fallback)
*   **Transcription:** ElevenLabs API
*   **Image Search:** SerpAPI
*   **Monorepo Management:** pnpm workspaces
*   **Containerization (Optional):** Docker

## System Flow Example (Text Input)

1.  **User:** Pastes text into the frontend UI and submits.
2.  **Frontend (`client/`):** Sends a `POST /api/media/text` request to the backend API.
3.  **Backend API (`server/`):**
    *   Authenticates the user.
    *   Validates the input.
    *   Creates a `sources` record in the PostgreSQL database with status `PENDING`.
    *   Enqueues a `PROCESS_SOURCE_TEXT` job in the Redis queue via BullMQ, passing the source ID and text.
    *   Responds to the frontend with the `sourceId` and a success message.
4.  **Frontend (`client/`):** Displays a processing indicator and may start polling a status endpoint (`GET /api/processing/status/:sourceId`).
5.  **Worker (`server/src/worker.ts`):**
    *   Picks up the `PROCESS_SOURCE_TEXT` job from the queue.
    *   Calls the AI Service (`ai.service.ts`) to analyze the text.
    *   AI Service uses the configured AI provider (e.g., Gemini) to generate structured content (title, sections, visual placeholders).
    *   Updates the `sources` record status to `PROCESSING` and stores the intermediate `lessonStructureJson`.
    *   Enqueues subsequent jobs (`PROCESS_VISUAL_PLACEHOLDERS`, etc.).
    *   ... (Further processing continues through the pipeline as defined in `job-pipeline.md`)
6.  **Frontend (`client/`):** Periodically fetches status updates until the source status is `COMPLETED` or `FAILED`. Once complete, it fetches the final note data (`GET /api/notes/:noteId`).

## Detailed Architecture Documents

*   **[Backend Architecture](backend.md)**
*   **[Frontend Architecture](frontend.md)**
*   **[Database Architecture](database.md)**
*   **[Job Pipeline Architecture](job-pipeline.md)** 