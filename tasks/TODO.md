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
- [ ] Implement API endpoint to get notes list (`/api/notes`)
- [ ] Implement API endpoint to get single note details (`/api/notes/:id`)
- [ ] Create frontend components to display notes list
- [ ] Create frontend component to display detailed note view

## Phase 8: Study Tools

---

## Phase 9: Audio Upload & Transcription Pipeline

- [x] Implement `/api/media/upload` endpoint for audio files (backend)
- [x] Implement BullMQ job for audio transcription (`transcribeAudio.job.ts`)
- [x] Integrate ElevenLabs API for transcription (with chunking, retries, and OpenAI fallback)
- [x] Update DB and job status throughout pipeline
- [ ] Create minimal React UI for audio upload and status (frontend)
- [ ] Display upload progress and show resulting `sourceId` and processing status
- [ ] Add error handling and user feedback in UI
- [ ] End-to-end test: upload audio, verify DB, and check transcription result

---

## Phase 10: UI Testing for Audio Pipeline

- [ ] Test audio upload UI with various file sizes and formats
- [ ] Test backend pipeline with ElevenLabs and OpenAI failover
- [ ] Document any issues or edge cases found during testing

- [x] Basic Audio Pipeline Test UI: Added a section to the dashboard using AudioUploadForm for manual audio pipeline testing.
