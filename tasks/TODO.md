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
