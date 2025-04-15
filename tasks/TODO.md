- [x] Initialize shared `package.json` and install core dependencies
- [x] Set up basic Express server structure
- [x] Configure environment variables (`.env.example`)
- [x] Implement basic health check endpoint
- [x] Set up Drizzle ORM configuration
- [x] Define initial database schema (users)
- [x] Generate initial database migration
- [x] Implement basic user registration endpoint (without password hashing yet)

## Phase 2: Authentication

- [x] Implement password hashing (bcrypt)
- [x] Set up Passport.js local strategy
- [x] Implement session management (e.g., connect-pg-simple)
- [x] Implement login endpoint
- [x] Implement logout endpoint
- [x] Implement auth status endpoint
- [x] Protect relevant API routes

## Phase 3: Core Frontend & Basic UI

- [x] Set up basic React structure with Vite
- [x] Set up Tailwind CSS & shadcn/ui
- [x] Implement basic routing (e.g., TanStack Router)
- [ ] Create basic layout components (Header, Footer, Sidebar)

## Phase 5: AI Integration (Text Processing)

- [x] Define AI provider interface (`IAiProvider`)
- [x] Implement Gemini provider (`gemini.provider.ts`)
- [x] Implement OpenAI provider (`openai.provider.ts`)
- [x] Implement `AiService` to manage providers and fallbacks
- [x] Define `GENERATE_LESSON_STRUCTURE` prompt
- [x] Integrate `AiService` into `PROCESS_SOURCE_TEXT` job

## Phase 6: Visual Processing

- [x] Define `visuals` table schema
- [x] Implement `PROCESS_VISUAL_PLACEHOLDERS` job
- [x] Implement `GENERATE_VISUAL` job skeleton
- [x] Implement SerpAPI image search utility (`image-search.ts`)
- [x] Integrate image search into `GENERATE_VISUAL` job
- [x] Implement logic to check for completion and enqueue `ASSEMBLE_NOTE` job

## Phase 7: Note Assembly & Display

- [x] Define `notes` table schema
- [x] Implement `ASSEMBLE_NOTE` job
- [x] Implement API endpoint to get notes list (`/api/notes`)
- [x] Implement API endpoint to get single note details (`/api/notes/:id`)
- [ ] Create frontend components to display notes list
- [ ] Create frontend component to display detailed note view

## Phase 8: Study Tools

- [ ] Define schema for flashcards and quizzes
- [ ] Implement AI prompts for generating flashcards
- [ ] Implement AI prompts for generating quizzes
- [ ] Create API endpoints for retrieving study tools
- [ ] Build frontend components for flashcard review
- [ ] Build frontend components for quiz taking

---

## Phase 9: Audio Upload & Transcription Pipeline

- [x] Implement `/api/media/upload` endpoint for audio files (backend)
- [x] Implement BullMQ job for audio transcription (`transcribeAudio.job.ts`)
- [x] Integrate ElevenLabs API for transcription (with chunking, retries, and OpenAI fallback)
- [x] Update DB and job status throughout pipeline
- [x] Create minimal React UI for audio upload and status (frontend)
- [x] Display upload progress and show resulting `sourceId` and processing status
- [x] Add error handling and user feedback in UI
- [x] End-to-end test: upload audio, verify DB, and check transcription result
- [x] Implement `/api/processing/status/:sourceId` endpoint for checking processing status
- [x] Fix job sequencing in audio processing pipeline
- [x] Add validation for audio file uploads
- [x] Improve error handling in audio processing pipeline

## Refactor: File Size & Modularity
- [x] Enforce <300 LOC per file (except orchestrator jobs)
- [x] Extract ElevenLabs chunking/temp helpers to elevenlabs.utils.ts
- [x] Refactor elevenlabs.processor.ts for orchestration-only logic
- [x] Standardize config/env usage and metadata access in transcribeAudio.job.ts
- [x] Confirm all server files are under 300 lines (except orchestrators)
- [x] Add checkpoint commit after successful pipeline test

---

## Phase 10: UI Testing and Optimization

- [x] Test audio upload UI with various file sizes and formats
- [x] Test backend pipeline with ElevenLabs and OpenAI failover
- [x] Document issues and edge cases in audio processing pipeline
- [x] Basic Audio Pipeline Test UI: Added AudioUploadForm component for testing
- [x] Optimize audio chunking for better processing speed
- [x] Add support for additional audio formats
- [x] Implement progress tracking for individual audio chunks
- [x] Improve visual feedback during long-running transcription jobs

## Phase 11: Documentation and Deployment

- [x] Update architecture documentation with audio processing details
- [ ] Create deployment guide for production environment
- [ ] Set up CI/CD pipeline for automated testing and deployment
- [ ] Create user documentation for audio upload and processing
- [ ] Implement logging and monitoring for production environment

## Phase 12: Additional Features

- [ ] Implement sharing functionality for notes
- [ ] Add collaboration features for shared notes
- [ ] Support for more input sources (e.g., website URLs, RSS feeds)
- [ ] Implement advanced search functionality (full-text search)
- [ ] Add support for organizing notes in folders/collections

## Phase 13: YouTube Pipeline
- [x] Implement YouTube transcript extraction utility (youtube-transcript or similar) — must extract timestamps and full transcript
- [x] Add /api/media/youtube endpoint to accept YouTube URLs and enqueue processing
- [x] Update job pipeline to handle YouTube sources (extract transcript with timestamps, save source URL and transcript for user, enqueue AI analysis, etc.)
- [x] Add error handling for unavailable/unsupported videos
- [x] Add frontend UI for submitting YouTube URLs
- [x] Show progress/status for YouTube processing in UI
- [x] Display resulting notes in dashboard
- [x] Update docs with detailed YouTube pipeline notes (flow, data model, error handling, etc.)

## Phase 14: Mistral OCR Pipeline (Images/PDFs)
- [x] Integrate Mistral OCR API (or local OCR) for image/PDF text extraction
- [x] Add /api/media/upload support for images and PDFs
- [x] Update job pipeline to handle OCR sources (extract text, enqueue AI analysis, etc.)
- [x] Add error handling for unsupported/failed OCR
- [x] Add frontend UI for uploading images and PDFs
- [x] Show progress/status for OCR processing in UI
- [x] Display resulting notes in dashboard
- [x] Implementation is robust, matches Mistral's documentation, and includes fallback logic.

### Core Processing Pipeline

*   `[-]` Implement YouTube transcript fetching.
*   `[-]` Implement PDF text extraction.
*   `[x]` Implement Audio transcription pipeline (ElevenLabs + Fallback).
    *   `[x]` Handle Supabase upload.
    *   `[x]` Queue transcription job.
    *   `[x]` Job downloads file from Supabase.
    *   `[x]` Job calls transcription service (ElevenLabs) with local file.
    *   `[x]` Job handles chunking for large files.
    *   `[-]` Implement OpenAI fallback for failed chunks.
    *   `[x]` Job updates DB with transcript/status.
    *   `[x]` Job enqueues next step (`PROCESS_SOURCE_TEXT`).
*   `[-]` Implement Image OCR.
