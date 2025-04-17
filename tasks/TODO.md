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
