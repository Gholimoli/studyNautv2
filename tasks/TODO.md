# Studynaut Project TODO List

## Core Setup & Authentication (Phase 1)

- [x] **Monorepo Setup:** Initialize `pnpm` workspace with `client` and `server` packages.
- [x] **Server Setup:** Basic Express server with TypeScript, routing, and basic middleware.
- [x] **Client Setup:** Vite + React + TypeScript setup.
- [x] **Database Setup:** Configure PostgreSQL and Drizzle ORM, define initial schemas (User, Source, Note, etc.).
- [x] **UI Foundation:** Integrate `shadcn/ui` and `Tailwind CSS`.
- [x] **Basic Layout:** Create `Layout`, `Header`, `Footer` components.
- [x] **Routing:** Implement basic routing with TanStack Router.
- [x] **User Registration:** Implement backend endpoint and frontend form.
- [x] **User Login:** Implement backend endpoint and frontend form.
- [x] **Password Hashing:** Use `bcryptjs` on the server.
- [x] **Session Management:** Implement server-side sessions (`express-session`).
- [x] **User Logout:** Implement backend endpoint and frontend trigger (e.g., in Header menu).
- [x] **Auth Status Check:** Create endpoint (`/api/auth/status`) and frontend hook (`useAuthStatus`).
- [x] **Route Protection:** Implement `beforeLoad` checks on protected routes using auth status.
- [x] **UI Feedback:** Add `Toaster` for auth notifications.
- [x] **Resolve Auth Bugs:** Fix circular dependency with `queryClient` and router.

## Content Submission & Processing (Phase 2)

- [ ] **Source Schema:** Finalize `sources` table schema in Drizzle.
- [ ] **Media Endpoints (Backend):**
    - [ ] `/api/media/upload` (for files: PDF, Audio, Image)
    - [ ] `/api/media/youtube` (for YouTube URLs)
    - [ ] `/api/media/text` (for raw text input)
- [ ] **File Storage:** Implement service to upload source files (e.g., to local storage for dev, cloud storage for prod).
- [ ] **Job Queue Setup:** Configure BullMQ with Redis for background processing.
- [ ] **Worker Process:** Set up the initial worker process (`server/src/worker.ts`).
- [ ] **Content Extraction Jobs:**
    - [ ] YouTube Transcript Extraction Job (`youtube-transcript`).
    - [ ] PDF Text Extraction Job (e.g., using `pdf-parse`).
    - [ ] Audio Transcription Job (ElevenLabs integration, fallback).
    - [ ] Image OCR Job (Mistral integration, fallback).
    - [ ] Raw Text Processing (passthrough).
- [ ] **Frontend Submission Forms/UI:** Create UI components for each submission type (YouTube URL, File Upload, Text Input).
- [ ] **API Integration (Frontend):** Connect frontend forms to backend media endpoints using TanStack Query mutations.
- [ ] **Processing Status Tracking (Backend):** Update `sources` table with `processingStatus` and `processingStage` during job execution.
- [ ] **Processing Status Display (Frontend):** Create UI to show users the status of their submitted sources (e.g., on Dashboard or a dedicated Sources page).
- [ ] **Dashboard Recent Notes:** Fetch and display actual recent notes using NoteCard. (In Progress)

## AI Analysis & Note Generation (Phase 3)

- [ ] **AI Service (`AiService`):** Implement core service to manage AI providers and prompts.
- [ ] **AI Provider Integration:** Implement Gemini and OpenAI providers.
- [ ] **Prompts:** Develop and refine prompts for lesson structure generation.
- [ ] **`PROCESS_SOURCE_TEXT` Job:** Implement job to take extracted text, call `AiService` for structure, and save intermediate results.
- [ ] **Visual Placeholder Processing (`PROCESS_VISUAL_PLACEHOLDERS` Job):** Implement job to parse visual opportunities and enqueue individual visual jobs.
- [ ] **Visual Generation (`GENERATE_VISUAL` Job):** Implement job using SerpAPI (or other configured visual provider).
- [ ] **Note Assembly (`ASSEMBLE_NOTE` Job):** Implement job to combine structured content and generated visuals into final note format (Markdown/HTML).
- [ ] **Note Schema:** Finalize `notes` table schema.
- [ ] **Save Final Note:** Store the assembled note in the database.

## Note Display & Management (Phase 4)

- [ ] **Notes List Page (`/notes`):** Display all user notes.
- [ ] **Note Detail Page (`/notes/:noteId`):** Display full note content (rendered Markdown/HTML).
- [ ] **API Endpoints:** Create backend endpoints (`/api/notes`, `/api/notes/:id`) to fetch notes.
- [ ] **Frontend Data Fetching:** Use TanStack Query `useQuery` hooks to fetch note data.
- [ ] **Note Actions:** Implement favorite toggle and delete functionality.

## Study Tools (Phase 5)

- [ ] **Flashcard Generation Job/Endpoint.**
- [ ] **Quiz Generation Job/Endpoint.**
- [ ] **Flashcard Review UI.**
- [ ] **Quiz Taking UI.**

## Refinement & Polish (Phase 6)

- [ ] **UI/UX Polish:** Address any remaining UI inconsistencies or rough edges.
- [ ] **Error Handling:** Improve error reporting and handling throughout the app.
- [ ] **Performance Optimization:** Identify and address any performance bottlenecks.
- [ ] **Testing:** Add more comprehensive tests (unit, integration, e2e).
- [ ] **Dark Mode.**

## Frontend

*   [x] Fix NoteCard rendering issues (layout, click handlers)
*   [x] Fix NoteCard favorite button functionality (visual state)
*   [x] Ensure NoteFolderMenu closes after moving note
*   [ ] Connect Sidebar "Favorites" link to filter NotesIndexPage (show `isFavorite: true` notes)
*   [x] Implement actual API calls (replace placeholders in NotesIndexPage, NoteCard, NoteFolderMenu) - *Partially done for NoteCard*
*   [x] Add UI for creating/managing user folders (sidebar)
*   [x] **Fix Sidebar folder item layout to match NavItem layout**
*   [ ] **Create Folder Detail Page/View (`/folders/:folderId`)**
*   [x] **Make Sidebar folder names link to Folder Detail Page**
*   [ ] **Verify notes disappear from list view after being moved out of scope**
*   [x] Implement Language Code and Flag display in NoteCard

## Backend

*   [x] Ensure new notes default to `folderId: null` during creation (e.g., in `ASSEMBLE_NOTE` job) - *Assuming this is handled, needs verification*
*   [ ] **Fix `/api/folders` endpoint to return accurate `noteCount` after refetch.**
*   [x] **Ensure `/api/notes` endpoint supports filtering by `folderId`**
*   [x] Implement actual API endpoints (auth, notes, folders, etc.) based on `api-endpoint.mdc` - *Partially done for notes*
*   [x] Implement database migrations for folders table (if not already done) - *Assuming done*
*   [ ] Investigate potential bug in folder creation API/logic causing phantom folders.
*   [x] Fix bug where `GET /api/notes` incorrectly returned `favorite: false` when undefined.
*   [x] Ensure `GET /api/notes` returns `languageCode`.

## General

*   [ ] Refine UI/UX based on feedback
*   [ ] Add comprehensive tests
*   [x] Synchronize `.mdc` and `.md` documentation (In Progress)

## High Priority Code Review Cleanup

- [x] **Investigate & Remove Redundant Directory:** Checked `studyNautv2-mirror/` and removed.
- [x] **Review Worker Restart Workflow:** Verified `pnpm dev` uses `nodemon`. Updated `docs/lessons-learned.md`.
- [x] **Improve Error Handling Consistency:** Enhanced global API error handler logging in `server/src/index.ts`.

## Medium Priority Code Review Cleanup

- [x] **Documentation Consistency:** Confirmed `.mdc` rules are primary source for remaining docs.
- [x] **Configuration Validation:** Added Zod validation for env vars in `server/src/core/config/config.ts`.
- [x] **Type Safety & Sharing:** Moved shared types to `@shared/types` and updated imports.
- [x] Refactor Large Files: Identifying files > 300 LOC and plan refactoring (e.g., worker jobs, services). (Worker structure confirmed good)
- [ ] **Frontend Styling Consistency:** Spot-check components against UI/Theme guidelines.

## Low Priority Code Review Cleanup

- [ ] **Naming Conventions:** Quick scan for deviations.
- [x] Refactor Large Files: Identifying files > 300 LOC and plan refactoring (e.g., worker jobs, services). (Worker structure confirmed good)
- [ ] **Dependency Review:** Check for unused/outdated packages.
- [ ] **`.gitignore` Completeness:** Add standard ignores.
- [ ] **Magic Strings/Constants:** Refactor literals into constants.
- [ ] **JSDoc Comments:** Assess coverage on exported functions/hooks.

## Feature Development
*(Add future feature tasks here)*

## Bugs
*(Add bug tracking here)*

## Completed (Recent)

- [x] Fix linter errors and refactor `mistral.provider.ts` to align with `IOcrProvider` interface.
- [x] Fix `NoteListItem` import and `tag` type error in `NoteCard.tsx`.
- [x] Refactor `server/src/core/worker.ts` into smaller, dedicated job handlers (verified existing structure matches target).

## To Do

- [ ] Refactor `server/src/core/worker.ts` into smaller, dedicated job handlers (e.g., in `server/src/core/jobs/`).

## Note Quality Enhancement Plan (July 2025)

**Objective:** Significantly improve the structure, visual integration, and styling of generated HTML notes to match high-quality examples.

### Phase 1: Refining AI Analysis and Content Structure
- [x] **Task 1.1:** Enhance `GENERATE_LESSON_STRUCTURE` prompt in `server/src/modules/ai/prompts/prompts.ts` to request richer JSON output (main topic, summaries, key points, content types, detailed visual suggestions with queries).
- [x] **Task 1.2:** Update TypeScript types (`server/src/types/ai.types.ts`) to match the new AI response structure (`LessonBlock`, etc.).
- [x] **Task 1.3:** Implement Zod validation in `AiService` to parse and validate the enhanced AI response structure. *(Existing validation logic in `AiService` uses the updated schema)*

### Phase 2: Improving Visual Element Pipeline
- [ ] **Task 2.1:** Modify `PROCESS_VISUAL_PLACEHOLDERS` job (`server/src/core/jobs/processVisualPlaceholders.job.ts`) to store detailed visual info (concept, description, query) in the `visuals` DB table.
- [ ] **Task 2.2:** Update the `visuals` database schema (Drizzle schema: `server/src/core/db/schema.ts`) to include new fields (`description`, `searchQuery`, `altText`, `sourceUrl`, `sourceTitle`) and run migrations.
- [ ] **Task 2.3:** Refine `GENERATE_VISUAL` job (`server/src/core/jobs/generateVisual.job.ts`):
    - [ ] Use the stored `searchQuery` for SerpAPI.
    - [ ] Retrieve multiple image candidates.
    - [ ] Implement image selection logic (scoring based on relevance).
    - [ ] Store selected image details (URL, alt, source) in the `visuals` record.
    - [ ] Update `visuals.status` correctly (`COMPLETED`, `FAILED`, `NO_IMAGE_FOUND`).

### Phase 3: Advanced HTML Generation and Styling
- [x] **Task 3.1:** Overhaul `ASSEMBLE_NOTE` job (`server/src/core/jobs/assembleNote.job.ts`):
    - [x] Implement/integrate a server-side templating engine (e.g., Handlebars).
    - [x] Create HTML templates/partials for note structure (using semantic HTML and Tailwind).
    - [x] Design partials for different `contentType`s (key takeaways, code blocks, definitions).
    - [x] Integrate completed visuals (`<figure>`, `<img>`, `<figcaption>`, `<cite>`).
    - [x] Render styled placeholders for failed/missing visuals.
    - [x] Ensure templates use styles from `theme.mdc` / `ui-guidelines.mdc`.
    - [x] **Fix Handlebars rendering error (`TypeError: options.inverse is not a function`)**
- [ ] **Task 3.2:** Define Tailwind class combinations for new content blocks (callouts, code blocks, placeholders) within the HTML templates/generation logic.

### Phase 4: Documentation and Iteration
- [-] **Task 4.1:** Update relevant documentation (`ai-prompts.mdc`, `architecture/job_pipeline.mdc`, `architecture/database.mdc`) - *Partially done*.
- [ ] **Task 4.2:** Thoroughly test the enhanced pipeline with diverse inputs and refine prompts/logic/templates based on output quality.

## New Tasks / Issues
- [ ] **Investigate SerpAPI Account Limits:** Image search in `GENERATE_VISUAL` job fails due to `"error": "Your account has run out of searches."`. Check API key, account status, and usage limits. Consider adding fallback or alternative image sources.
- [x] **Fix Frontend Note Display:** Note detail page showed "No content available". Resolved by rendering `htmlContent` via `dangerouslySetInnerHTML` instead of using `ReactMarkdown` on `markdownContent`.
