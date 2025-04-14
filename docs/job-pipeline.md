# Job Pipeline Architecture

This document describes the architecture and workflow of the background job processing system in Studynaut, powered by BullMQ and Redis.

## Overview

Long-running tasks, such as file uploads, transcription, AI analysis, visual generation, and note assembly, are handled asynchronously by a background worker process. This prevents blocking the main API server and provides a better user experience.

## Technologies

*   **Job Queue:** BullMQ
*   **Queue Backend:** Redis
*   **Worker Process:** A separate Node.js process (`server/src/worker.ts`)
*   **Producer:** The main API server (`server/src/server.ts`) enqueues jobs.

## Key Concepts

*   **Queue:** A named queue in Redis (e.g., `note-processing`) where jobs are placed.
*   **Job:** A unit of work placed onto the queue, containing data necessary for its execution (e.g., `{ sourceId: 123, text: "..." }`).
*   **Producer:** Code that adds jobs to the queue (typically within API route handlers or services).
*   **Worker:** A process that listens to one or more queues, picks up jobs, and executes the associated processor function.
*   **Processor Function:** A function defined in the worker that contains the logic to handle a specific job type.

## Main Queue

*   **Name:** `note-processing` (or similar, defined in config)
*   **Purpose:** Handles the entire pipeline for processing a source into a note and study tools.

## Job Types & Workflow

The processing pipeline involves several distinct job types, often enqueued sequentially as dependencies.

1.  **`PROCESS_SOURCE_TEXT`**
    *   **Triggered by:** API endpoints for text, YouTube, PDF, audio (after initial upload/extraction).
    *   **Input Data:** `{ sourceId: number, textContent: string, (other source details...) }`
    *   **Processor Logic (`server/src/core/jobs/processSourceText.job.ts`):**
        1.  Retrieve the `source` record from the database.
        2.  Update `source.processingStatus` to `PROCESSING`, `processingStage` to `ANALYZING_TEXT`.
        3.  Call `AiService.generateLessonStructure(textContent)`.
        4.  AI Service uses primary/fallback AI to generate JSON with `title`, `structure` array (with `[VISUAL::...]` placeholders), and `visualOpportunities`.
        5.  Save the AI-generated `title` and `lessonStructureJson` to the `source` record.
        6.  Update `source.processingStage` to `PENDING_VISUAL_PROCESSING`.
        7.  Enqueue the `PROCESS_VISUAL_PLACEHOLDERS` job for the same `sourceId`.
    *   **On Failure:** Update `source.processingStatus` to `FAILED`, log error.

2.  **`PROCESS_VISUAL_PLACEHOLDERS`**
    *   **Triggered by:** Successful completion of `PROCESS_SOURCE_TEXT`.
    *   **Input Data:** `{ sourceId: number }`
    *   **Processor Logic (`server/src/core/jobs/processVisualPlaceholders.job.ts`):**
        1.  Retrieve the `source` record, ensuring `lessonStructureJson` exists.
        2.  Parse `lessonStructureJson` to find all `[VISUAL::description]` placeholders.
        3.  For each unique placeholder:
            *   Generate a unique `placeholderId` (e.g., hash the description).
            *   Create a `visuals` record in the database with `sourceId`, `placeholderId`, `description`, and `status: 'PENDING'`. Generate `searchQuery` from description.
            *   Enqueue a `GENERATE_VISUAL` job with `{ visualId: newVisual.id }`.
        4.  Update `source.processingStage` to `GENERATING_VISUALS`.
    *   **On Failure:** Update `source.processingStatus` to `FAILED`, log error.

3.  **`GENERATE_VISUAL`** (Runs concurrently for each visual)
    *   **Triggered by:** `PROCESS_VISUAL_PLACEHOLDERS` for each identified visual opportunity.
    *   **Input Data:** `{ visualId: number }`
    *   **Processor Logic (`server/src/core/jobs/generateVisual.job.ts`):**
        1.  Retrieve the `visuals` record.
        2.  Update `visuals.status` to `PROCESSING`.
        3.  Use the configured visual provider (e.g., SerpAPI via `image-search.ts`) with `visuals.searchQuery` to find an image URL.
        4.  If successful:
            *   Save the `imageUrl` to the `visuals` record.
            *   Update `visuals.status` to `COMPLETED`.
        5.  If failed:
            *   Log the error.
            *   Update `visuals.status` to `FAILED`.
            *   Store `errorMessage`.
        6.  **Crucially:** Check if this is the *last* visual for the associated `sourceId` to complete (either successfully or failed). This requires tracking the total count and completion status of visuals for a source.
        7.  If it is the last visual, enqueue the `ASSEMBLE_NOTE` job for the `sourceId`.
    *   **Concurrency:** BullMQ handles running multiple instances of this job processor concurrently based on worker settings.

4.  **`ASSEMBLE_NOTE`**
    *   **Triggered by:** Completion of the *last* `GENERATE_VISUAL` job for a source.
    *   **Input Data:** `{ sourceId: number }`
    *   **Processor Logic (`server/src/core/jobs/assembleNote.job.ts`):**
        1.  Retrieve the `source` record and all associated `visuals` records.
        2.  Parse the `source.lessonStructureJson`.
        3.  Iterate through the structure, replacing `[VISUAL::...]` placeholders:
            *   Find the corresponding `visuals` record by `placeholderId`.
            *   If `visuals.status === 'COMPLETED'`, replace placeholder with markdown/HTML for the image (`imageUrl`).
            *   If `visuals.status === 'FAILED'`, replace placeholder with a fallback message or placeholder image.
        4.  Generate final `markdownContent` (and optionally `htmlContent`).
        5.  Create the final `notes` record in the database, linking it to the `sourceId` and `userId`, including the generated `title` and `markdownContent`.
        6.  Update `source.processingStage` to `PENDING_STUDY_TOOLS`.
        7.  Enqueue the `GENERATE_STUDY_TOOLS` job with `{ noteId: newNote.id }`.
    *   **On Failure:** Update `source.processingStatus` to `FAILED`, log error.

5.  **`GENERATE_STUDY_TOOLS`**
    *   **Triggered by:** Successful completion of `ASSEMBLE_NOTE`.
    *   **Input Data:** `{ noteId: number }`
    *   **Processor Logic (`server/src/core/jobs/generateStudyTools.job.ts`):**
        1.  Retrieve the `notes` record, including `markdownContent`.
        2.  Call `AiService.generateQuiz(markdownContent)`.
        3.  Save generated quiz questions to the `quizzes` table.
        4.  Call `AiService.extractFlashcards(markdownContent)`.
        5.  Save generated flashcards to the `flashcards` table.
        6.  Update `source.processingStatus` to `COMPLETED` and clear `processingStage`.
    *   **On Failure:** Log error, potentially update `source.processingStatus` to `COMPLETED_WITH_ERRORS` or similar, but allow the note to be usable.

## Worker Implementation (`server/src/worker.ts`)

*   Initializes database connection, AI services, etc. (needs access to config).
*   Creates a BullMQ `Worker` instance, connecting to the Redis queue.
*   Passes an async function to the `Worker` constructor that acts as the main processor.
*   Inside the processor function:
    *   Use a `switch` statement on `job.name` (e.g., `'PROCESS_SOURCE_TEXT'`, `'GENERATE_VISUAL'`).
    *   Call the appropriate job handler function (imported from `server/src/core/jobs/`), passing `job.data`.
*   Sets up listeners for events like `'completed'` and `'failed'` for logging.
*   Includes error handling for unexpected processor failures.

## Important Considerations

*   **Idempotency:** Jobs should ideally be idempotent, meaning running them multiple times with the same input produces the same result. This helps recovery from failures.
*   **Concurrency Control:** Configure worker concurrency appropriately based on available resources and external API rate limits.
*   **Error Handling & Retries:** Configure BullMQ job retry strategies (e.g., exponential backoff) for transient failures (network issues, API rate limits).
*   **Job Dependencies:** The flow relies on jobs enqueuing the next step upon successful completion. Handling the dependency of `ASSEMBLE_NOTE` on *all* `GENERATE_VISUAL` jobs requires careful state management (e.g., querying visual statuses before enqueuing `ASSEMBLE_NOTE`).
*   **Monitoring:** Monitor queue lengths, job failure rates, and worker health.
*   **Worker Restart:** **CRITICAL:** The worker process (`node dist/worker.js` or similar) must be restarted manually after any code changes in `worker.ts` or its dependencies for changes to take effect. 