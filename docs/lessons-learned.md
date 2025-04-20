# Lessons Learned

This document summarizes critical insights and challenges encountered during the development of the Studynaut project.

## 1. Architecture & Design

### Insights

*   **Async Job Complexity:** Managing state and dependencies across multiple asynchronous background jobs (BullMQ pipeline) is inherently complex. Careful design of job dependencies (e.g., ensuring `ASSEMBLE_NOTE` only runs after *all* `GENERATE_VISUAL` jobs for a source are complete), robust status tracking (`sources.processingStatus`, `sources.processingStage`, `visuals.status`), and considering idempotency are crucial.
*   **Worker Isolation:** The background job worker (`worker.ts`) runs as a separate Node.js process. It requires its own configuration loading, database connections, and service instantiations. It **does not** share the runtime memory or context of the main API server.
*   **Monolithic Worker Challenges:** As job logic grows, a single large worker file (`worker.ts` dispatching based on job name) can become hard to maintain. Refactoring job logic into dedicated processor functions within `server/src/core/jobs/` improves organization.
*   **Visual Generation Strategy:** Direct AI image generation can be slow, costly, or unreliable. Using an image search API (SerpAPI) as the primary strategy for finding relevant existing visuals based on AI-generated descriptions proved more pragmatic initially. Robust fallback logic (placeholders) for failed visual jobs is essential.
*   **Configuration Management:** Centralized and validated configuration (e.g., `server/src/core/config/index.ts` using Zod) is vital for managing API keys, feature flags, and environment-specific settings for both the server and the worker.

### Challenges Faced

*   Reliably tracking the completion of multiple concurrent `GENERATE_VISUAL` jobs to trigger the subsequent `ASSEMBLE_NOTE` job.
*   Handling potential rate limits or transient errors from multiple external APIs (AI, Transcription, Image Search) within jobs.
*   Efficiently passing large data (like full text content) between jobs or relying on database persistence.
*   Initial setup of TypeScript path aliases (`tsconfig.json`) across packages in the monorepo.

## 2. Development Workflow & Debugging

### Insights

*   **Zod `optional().transform()`:** Be cautious when using `.optional().transform()` in Zod schemas, especially with boolean-like inputs (e.g., 'true'/'false'). The transform function still runs even if the field is optional and not present in the input, receiving `undefined` as its value. This can lead to unexpected default values (e.g., `undefined === 'true'` resulting in `false`) if not handled explicitly within the transform. Always check for `undefined` in the transform if the preceding `.optional()` is intended to mean "no value provided".
*   **List vs. Detail Data Consistency:** Ensure that data required for list item displays (like `NoteCard`) is included in the data fetched for the list view (e.g., `NoteListItem` type and the corresponding API endpoint). Avoid relying solely on detail view data (`NoteDetail`) for information needed in summaries or list cards, as this can lead to missing information (e.g., `languageCode` initially missing from `GET /api/notes`).
*   **Worker Restart Requirement:** **CRITICAL:** Changes made to the worker code (`worker.ts`) or its direct dependencies **do not take effect** until the worker Node.js process is manually restarted. This is a frequent source of confusion when debugging job logic. (Restart via `Ctrl+C` and `pnpm dev` locally).
*   **Worker Path Resolution:** TypeScript path aliases (`@/...`) might not resolve correctly within the worker's execution context (`ts-node -r tsconfig-paths/register`) for all module locations, even if the `tsconfig.json` paths seem correct. This can lead to runtime "Cannot find module" errors despite passing linter checks or vice-versa. Using relative paths can sometimes be a workaround, but the root cause might be in the build/execution setup. Verifying the exact file location is crucial.
*   **Debugging Asynchronous Flows:** Requires extensive logging (`console.log` in the worker is effective) and potentially inspecting the job queue state (e.g., via Redis CLI) and database records (`sources`, `visuals`, `notes` tables).
*   **API/Schema Mismatches:** Discrepancies between frontend expectations (TanStack Query), API responses (Express routes), shared type definitions (`shared/` package or duplicated types), and database schemas (`schema.ts`) are common sources of bugs. Consistent use of shared types and end-to-end testing helps.
*   **Environment Consistency:** Ensuring API keys and database URLs are correctly set up in `.env` files for both local development and deployment environments is crucial.

### Solutions Implemented

*   Added detailed logging within job processors.
*   Implemented robust status tracking on `sources` and `visuals` tables.
*   Utilized database transactions where appropriate for atomicity.
*   Configured path aliases in `tsconfig.json` for cleaner imports.

## 3. External API Integration

### Insights

*   **AI Models Evolve:** AI APIs (Gemini, OpenAI) change. Response formats, model capabilities, and token limits need periodic review. Prompts may require tuning.
*   **Provider Abstraction:** Abstracting AI providers behind a common interface (`IAiProvider`) makes it easier to switch between models or add new ones.
*   **Error Handling:** External APIs can fail for various reasons (rate limits, invalid input, service outages). Implement retries (BullMQ offers this) and fallback logic (e.g., primary -> fallback AI provider).
*   **Prompt Engineering:** The quality of AI output heavily depends on well-structured prompts. Iterative refinement is necessary. Requesting structured output (JSON) simplifies processing.
*   **Image Search Quality:** SerpAPI query generation needs to be specific. Using AI to generate detailed search phrases from context improves relevance.
*   **API Reliability & Fallbacks:** External APIs (like Mistral OCR) can have intermittent failures (e.g., 520 errors) or specific limitations (e.g., 422 errors for certain input types/formats). Implementing robust fallback logic (e.g., `OcrService` falling back from Mistral to Gemini) is essential for pipeline reliability.
*   **API Behavior Verification:** Providers might handle different inputs differently (e.g., Mistral OCR requiring raw buffer for PDF but `data_uri` for images). It's important to test and verify the specific API requirements for each use case.
*   **AI Models Evolve Quickly:** Google Gemini and OpenAI models undergo frequent updates. Adapting to new capabilities, response formats, and token limits is an ongoing process.

### Solutions Implemented

*   Implemented `AiService` with primary/fallback logic.
*   Designed prompts to request JSON output.
*   Added basic retry mechanisms via BullMQ job options.
*   Utilized an image search utility (`image-search.ts`).

## 4. Database and Data Management

### Insights

*   **Drizzle ORM:** Provides strong typing and a good developer experience but requires explicit migration generation (`db:generate`) and application (`db:migrate:dev`). `drizzle-kit push` is convenient for simple dev changes but not recommended for production.
*   **Schema Evolution:** Migrations must be carefully managed and applied consistently across environments.
*   **JSONB Fields:** Useful for flexible metadata (`sources.metadata`) or intermediate structures (`sources.lessonStructureJson`), but querying specific nested values can be less efficient than querying indexed columns.

### Solutions Implemented

*   Established clear `pnpm` scripts for database generation and migration.
*   Used `schema.ts` as the single source of truth for database structure.
*   Applied appropriate indexing on foreign keys and status columns.

## 5. User Experience

### Insights

*   **Async Feedback:** Long-running background processes require clear UI feedback (loading states, progress indicators, success/error notifications via toasts).
*   **Graceful Degradation:** If parts of the process fail (e.g., visual generation), the core functionality (note creation) should still complete where possible, perhaps with placeholders.
*   **Responsiveness:** The frontend must remain interactive even while backend processing occurs.

### Solutions Implemented

*   Frontend polling of status endpoints (`/api/processing/status/:sourceId`).
*   Use of loading skeletons and spinners during data fetching (TanStack Query `isLoading`).
*   Toast notifications for job completion/failure.

## 6. Documentation

### Insights

*   **Centralized Docs:** Maintaining documentation within the repository (`/docs`) makes it accessible and version-controlled alongside the code.
*   **Key Documents:** PRD, Architecture diagrams/docs, Setup Guide, API Reference, and this Lessons Learned document are essential for onboarding and maintenance.
*   **Keeping Docs Updated:** Documentation needs to be actively updated as the codebase evolves, ideally as part of the development process or via regular reviews.

### Solutions Implemented

*   Created the `/docs` directory structure.
*   Leveraged existing `.mdc` rules to populate initial documents.
*   Established the `/update` command workflow (to be used going forward).

## 9. Audio Transcription Pipeline Challenges

### Insights

*   **Job Data vs. Database State:** Background jobs often need specific data passed directly in the job payload (like temporary file paths) or fetched reliably from the database. Relying on data *only* in one place can lead to mismatches.
*   **Cloud Storage Access:** Jobs running in the worker environment **cannot directly access cloud storage paths** (like Supabase Storage URLs or paths) as if they were local file system paths. Files must be explicitly downloaded to the worker's local filesystem before being processed by tools expecting local file paths (like `ffmpeg` or external APIs requiring file reads).
*   **Metadata Consistency:** Ensure that data saved in database JSON `metadata` fields matches precisely what consuming processes (like background jobs) expect to find. Field names and structure are critical.

### Challenges Faced

*   **`Storage path missing in metadata` Error:** The audio transcription job failed because the `MediaService` saved the Supabase path to `source.originalStoragePath` while the job expected it in `source.metadata.storagePath`.
    *   **Fix:** Updated `MediaService` to store the `storagePath` correctly within the `metadata` field during source creation.
*   **`ENOENT: no such file or directory` Error:** The transcription job tried to use the Supabase path (`user_X/audio/...`) directly as a local path when calling the transcription service (ElevenLabs), which failed as the file wasn't locally present.
    *   **Fix:** Implemented logic in `processAudioTranscriptionJob` to use the `StorageService` to download the audio file from Supabase to a temporary local directory. Passed the *temporary local path* to the transcription service. Added a `finally` block to ensure the temporary file is deleted after processing.
    *   **Fix:** Added the required `downloadFile` method to `StorageService` to handle downloading from Supabase.

### Solutions Implemented

*   Ensured consistent metadata handling between `MediaService` and the transcription job.
*   Implemented a download step in the transcription job to fetch files from cloud storage before local processing.
*   Added robust cleanup for temporary files using `finally` blocks.

## 10. Circular Dependencies

### Insights

*   **Circular Dependencies:** Be mindful of import cycles, especially between core setup files (like `main.tsx` and `router.tsx`) and configuration/utility files (like `queryClient`). A common issue arises when the router needs the `queryClient` for pre-load checks (`beforeLoad`) while the main app setup also needs the router. **Solution:** Instantiate and export shared instances like `queryClient` from a dedicated, low-level utility file (e.g., `src/lib/query-client.ts`) that doesn't import higher-level modules like the router or main app component. 

## 11. Authentication Flow Debugging

### Insights

*   **404 on Login POST:** If the frontend sends `POST /api/auth/login` but gets a 404, double-check that the route definition for `POST /login` is not commented out or missing in the relevant backend routes file (e.g., `auth.routes.ts`).
*   **401 "Missing credentials" (Passport):** If `passport.authenticate('local')` returns a 401/400 without hitting controller logs, ensure the `LocalStrategy` is configured correctly. Specifically, check the `usernameField` option (e.g., `{ usernameField: 'email' }`) matches the field name sent from the frontend form (`req.body.email` vs `req.body.username`).
*   **Post-Login Refetch Failure ("Missing queryFn"):** Calling `queryClient.fetchQuery({ queryKey: [...] })` requires TanStack Query to know the corresponding `queryFn`. If no component using the hook defining that query key (e.g., `useAuthStatus`) is mounted, `fetchQuery` will fail unless the `queryFn` is explicitly provided *within the `fetchQuery` call itself*. This is common when triggering refetches programmatically immediately after mutations (like login) before the UI has necessarily re-rendered with components that use the target query hook.
*   **Post-Login 401 on Status Check:** If login succeeds but an immediate subsequent request (like `GET /api/auth/status` during a pre-navigation check or component mount) fails with 401, it might be a timing issue. The browser/server session might not be fully established. Explicitly `await queryClient.fetchQuery(...)` for the status *after* the login mutation succeeds and *before* navigating can help ensure the session is recognized.

### Solutions Implemented

*   Uncommented the `POST /login` route in `auth.routes.ts`.
*   Configured Passport `LocalStrategy` with `{ usernameField: 'email' }` to match the frontend form data.
*   Provided the `fetchAuthStatus` function explicitly as the `queryFn` when calling `queryClient.fetchQuery({ queryKey: ['authStatus'] })` in the `LoginPage` component's `onSuccess` handler for the login mutation.

## 12. Configuration Validation & Usage

### Insights

*   **Startup Validation:** Implementing environment variable validation at startup (e.g., using Zod in `server/src/core/config/config.ts`) is crucial to prevent runtime errors caused by missing or invalid configuration (API keys, DB URLs, etc.).
*   **Centralized Config Object:** Consistently using a central, validated `config` object throughout the application (server, worker, utilities) is better than accessing `process.env` directly in multiple places. It ensures that code relies on validated configuration values.

### Challenges Faced

*   **Initial Zod Schema Mismatch:** The initial Zod schema added for validation used restrictive enums for AI provider names (`gemini`, `openai`) instead of allowing the specific model strings (`gemini-2.0-flash`, `gpt-4o`) present in the `.env` file, causing a startup crash.
    *   **Fix:** Modified the Zod schema in `config.ts` to accept `string` types for `PRIMARY_AI_PROVIDER` and `FALLBACK_AI_PROVIDER`.
*   **Incorrect Config Access in Providers:** After introducing the central `config` object (which nested AI keys under `config.ai.*`), several provider/utility files (`gemini.provider.ts`, `openai.provider.ts`, `mistral.provider.ts`, `image-search.ts`, `elevenlabs.processor.ts`) were still trying to access keys directly from the top-level `config` or `process.env`, leading to runtime errors or potential crashes.
    *   **Fix:** Updated all affected provider/utility files to import and use the validated `config` object and access the necessary API keys via the correct nested path (e.g., `config.ai.googleApiKey`, `config.ai.serpapiKey`).

### Solutions Implemented

*   Added Zod schema validation to `server/src/core/config/config.ts`.
*   Refactored API provider files and utilities to import and use the validated `config` object instead of `process.env` directly.

## 13. Handlebars Rendering & Job State

### Insights

*   **Handlebars Helper Scope:** Handlebars helpers can be called in **block** (`{{#helper}}...{{/helper}}`) or **inline** (`{{helper}}` or `{{#if (helper ...)}}`) contexts. Helpers intended for block usage *must* handle the `options` argument correctly, specifically checking for `options.fn` and `options.inverse`. Attempting to access `options.inverse` when the helper is called inline (where `options` isn't passed as the last argument) will cause a `TypeError: options.inverse is not a function`.
    *   **Solution:** Implement robust helpers that check for the existence and type of `options` and `options.fn` to determine if they are being called inline or as a block, and handle both cases appropriately.
*   **Frontend/Backend Data Mismatch:** Ensure the frontend rendering logic matches the data format provided by the backend. If the backend saves pre-rendered HTML (`htmlContent`), the frontend should render it using `dangerouslySetInnerHTML`, not attempt to process it as Markdown (`markdownContent`) with libraries like `react-markdown`.
*   **BullMQ Job `retry()` Behavior:** The `job.retry()` method might appear to fail silently if the job fails again extremely quickly after being moved to the `waiting` state. The job might transition from `failed` -> `waiting` -> `active` -> `failed` faster than external checks can observe the intermediate `waiting` state. Checking the job's state immediately after calling `retry()` within the same script might report `active` or even `failed`, which can be misleading.

### Challenges Faced

*   **Persistent `TypeError: options.inverse is not a function`:** The `ASSEMBLE_NOTE` job repeatedly failed with this error during Handlebars rendering. Initial fixes targeting a `findVisual` helper didn't resolve it. The root cause was traced to the `eq` helper potentially being called with invalid data during the rendering of the `section.hbs` partial.
*   **Job Retries Appearing Ineffective:** Attempts to retry the failed `ASSEMBLE_NOTE` job using `job.retry()` repeatedly left the job in the `failed` state in Redis, making it seem like the retry mechanism was broken.
*   **Frontend Note Display Empty:** The note detail page showed "No content available" despite the backend job completing successfully and saving HTML content to the database.

### Solutions Implemented

*   Made the `eq` Handlebars helper in `assembleNote.job.ts` robust by adding checks for `null`/`undefined` arguments and handling block vs. inline calls correctly.
*   Modified the frontend `NoteDetailPage.tsx` component to remove `ReactMarkdown` and instead render the `note.htmlContent` field using `dangerouslySetInnerHTML`.
*   Created and used a `delete-job.ts` script to remove potentially corrupted/stuck failed jobs from the queue before resubmitting content.

## 14. Visual Placeholder Pipeline Debugging (April 2025)

### Insights

*   **AI Output Consistency:** Different AI models (primary vs. fallback) might return slightly different JSON structures or omit optional fields. For example, a fallback provider might include `visual_placeholder` blocks in the main `structure` but not populate the `description` field within those blocks (expecting it only in the top-level `visualOpportunities` array).
*   **Job Logic Dependencies:** Logic relying on specific fields being present (like checking `block.description` in `findVisualPlaceholders`) needs to be robust against variations in AI output. It's often better to fetch required data from the canonical source (e.g., `visualOpportunities` array) using a common ID (`placeholderId`).
*   **Job Sequencing:** The order of operations within a job is critical. Normalizing data (e.g., `normalizeType` in `assembleNote.job.ts`) before processing it based on its original state (e.g., `hydrateVisuals` looking for `visual_placeholder`) can lead to logic failures.
*   **Triggering Dependent Jobs:** Relying on multiple concurrent jobs (`GENERATE_VISUAL`) to correctly trigger a single subsequent job (`ASSEMBLE_NOTE`) requires careful state management. Each completing job must check if it's the *last* one for the given context (e.g., `sourceId`) before triggering the next step. Using database status/stage fields (`sources.processingStage`, `visuals.status`) is essential for this coordination.
*   **Premature Job Execution:** A job might be enqueued prematurely (e.g., due to a previous failed run not being cleaned up or a logic bug) and run before its dependencies are met, leading to incomplete results (like notes assembled before visual generation completes).
*   **External Image URL Reliability:** Image URLs obtained from external searches (SerpAPI/Serper) might be temporary, protected, or otherwise unsuitable for direct embedding (e.g., `lookaside.fbsbx.com` URLs). This can result in broken images even if the pipeline logic is correct.

### Challenges Faced

*   **Placeholders Not Detected:** `PROCESS_VISUAL_PLACEHOLDERS` initially failed to find placeholders because the `findVisualPlaceholders` function incorrectly required a `description` field within the placeholder block itself.
*   **Assembly Before Visuals Ready:** The `ASSEMBLE_NOTE` job was running before `GENERATE_VISUAL` jobs completed, resulting in notes with fallback placeholders instead of images.
*   **Broken Images:** Even after fixing the pipeline, one image failed to render because its URL (from `lookaside.fbsbx.com`) was not embeddable.

### Solutions Implemented

*   Relaxed the check in `findVisualPlaceholders` to only require `contentType` and `placeholderId`.
*   Modified `PROCESS_VISUAL_PLACEHOLDERS` to fetch visual details (`description`, `concept`, `searchQuery`) from the `visualOpportunities` array based on the found `placeholderId`.
*   Corrected the order of operations in `ASSEMBLE_NOTE`, ensuring `hydrateVisuals` runs *before* `normalizeStructure`.
*   Ensured `PROCESS_VISUAL_PLACEHOLDERS` sets the `sources.processingStage` to `GENERATING_VISUALS`.
*   Verified that the completion check in `generateVisual.job.ts` correctly counts remaining visuals and checks the source stage before enqueueing `ASSEMBLE_NOTE`.
*   Removed premature `ASSEMBLE_NOTE` enqueueing from `processVisualPlaceholders.job.ts`.
*   Added debug logging to `visual.hbs` to display the problematic URL.
*   (Next Step Recommended): Implement filtering in `generateVisual.job.ts` to discard problematic image URLs (e.g., from `fbsbx.com`). 