# Product Requirements Document: Studynaut

**Version:** 1.0
**Date:** 2025-04-15

## 1. Introduction

### 1.1. Vision
Studynaut aims to be the leading AI-powered learning companion, transforming how users interact with educational content. By converting diverse materials into structured, interactive notes with integrated visuals and study aids, Studynaut empowers users to learn more effectively and efficiently.

### 1.2. Goals
* Provide a seamless experience for importing various study materials.
* Leverage state-of-the-art AI to generate high-quality, structured notes and study tools.
* Integrate relevant visuals sourced via search engines (SerpAPI) to enhance learning.
* Offer an engaging and intuitive user interface for learning and note management.
* Build a flexible and maintainable platform capable of rapid adaptation to new AI models and features.
* Ensure reliable and performant processing of user content using a robust job queue (BullMQ).

### 1.3. Target Audience
* Students (High School, College, University)
* Researchers and Academics
* Professionals undertaking continuous learning or certifications
* Lifelong learners seeking to organize and understand information from various sources.

## 2. Functional Requirements

### 2.1. User Authentication & Profile
* **FR-AUTH-01:** Users must be able to register for a new account using an email/username and password.
* **FR-AUTH-02:** Registered users must be able to log in using their credentials.
* **FR-AUTH-03:** Users must remain logged in via sessions/tokens until explicitly logging out or session expiry.
* **FR-AUTH-04:** Users must be able to log out.
* **FR-AUTH-05:** Users should be able to view and update basic profile information (e.g., display name, potentially avatar).
* **FR-AUTH-06:** Users should be able to change their password securely.

### 2.2. Source Material Input
* **FR-INPUT-01:** Users must be able to initiate note creation by providing a YouTube video URL.
* **FR-INPUT-02:** Users must be able to initiate note creation by uploading a PDF document.
* **FR-INPUT-03:** Users must be able to initiate note creation by uploading an audio file (common formats like MP3, WAV, M4A).
* **FR-INPUT-04:** Users must be able to initiate note creation by uploading an image file (common formats like PNG, JPG/JPEG).
* **FR-INPUT-05:** Users must be able to initiate note creation by pasting or typing plain text.
* **FR-INPUT-06:** The system must provide clear feedback during the upload/processing initiation phase.

### 2.3. Note Generation & Processing
* **FR-NOTEGEN-01:** For YouTube videos, the system must extract the transcript (with timestamps) using the youtube-transcript library.
* **FR-NOTEGEN-02:** For PDFs, the system must extract the text content.
* **FR-NOTEGEN-03:** For audio files, the system must transcribe the speech to text using ElevenLabs API.
* **FR-NOTEGEN-04:** For images, the system must perform OCR to extract text.
* **FR-NOTEGEN-05:** The system must handle long content effectively using semantic chunking before AI analysis.
* **FR-NOTEGEN-06:** The system must use AI models (configured providers: Gemini Flash as primary, GPT-4o as fallback) to analyze the extracted text/transcript.
* **FR-NOTEGEN-07:** AI analysis must generate:
    * A concise, relevant title for the note.
    * Well-structured content (headings, summaries, bullet points, key takeaways).
    * Visual opportunities with descriptions and search queries.
    * Key terms or concepts (optional).
* **FR-NOTEGEN-08:** Generated notes from time-based media must preserve the original transcript with timestamps.
* **FR-NOTEGEN-09:** The system must provide real-time progress updates to the user during processing stages.
* **FR-NOTEGEN-10:** The system must gracefully handle errors during processing and report meaningful status to the user.
* **FR-NOTEGEN-11:** The note generation process follows a defined job pipeline:
    1. **`PROCESS_SOURCE_TEXT` Job:** Extracts text, calls AI to generate `lessonStructureJson`, sets stage to `PENDING_VISUAL_PROCESSING`, enqueues `PROCESS_VISUAL_PLACEHOLDERS`.
    2. **`PROCESS_VISUAL_PLACEHOLDERS` Job:** Parses `lessonStructureJson`, creates `visuals` records in DB, enqueues individual `GENERATE_VISUAL` jobs.
    3. **`GENERATE_VISUAL` Job(s):** Run concurrently for each visual using SerpAPI to find relevant images.
    4. **`ASSEMBLE_NOTE` Job:** Processes the structure, substituting visual placeholders with images or fallbacks, creates the final note.
    5. **`GENERATE_STUDY_TOOLS` Job:** Creates quiz/flashcards based on the note content.
* **FR-NOTEGEN-12:** Background job processing must be managed by BullMQ with Redis.

### 2.4. Note Management
* **FR-NOTEMGMT-01:** Users must be able to view a list of all their generated notes.
* **FR-NOTEMGMT-02:** Users should be able to search their notes by title or content.
* **FR-NOTEMGMT-03:** Users should be able to filter notes by source type or favorites.
* **FR-NOTEMGMT-04:** Users must be able to view the full content of a specific note, including structure, visuals, and transcript.
* **FR-NOTEMGMT-05:** Users must be able to mark notes as favorites.
* **FR-NOTEMGMT-06:** Users must be able to delete notes.

### 2.5. Note Interaction & Study Tools
* **FR-STUDY-01:** The system should allow users to translate note content into selected languages.
* **FR-STUDY-02:** The system must generate flashcards based on note content.
* **FR-STUDY-03:** Users must be able to view and manage flashcard decks associated with notes.
* **FR-STUDY-04:** Users must be able to review flashcards using a simple interface.
* **FR-STUDY-05:** The system must generate quizzes based on note content.
* **FR-STUDY-06:** Users must be able to take quizzes and receive immediate scoring/feedback.
* **FR-STUDY-07:** The system should track user study sessions.

### 2.6. AI Model Flexibility
* **FR-AI-01:** The backend architecture must support configurable primary and fallback AI models.
* **FR-AI-02:** The system must attempt processing with the primary AI model first.
* **FR-AI-03:** If the primary model fails, the system must automatically attempt the fallback model.
* **FR-AI-04:** New AI model providers must be easily integrated by implementing the standard interface.
* **FR-AI-05:** Visual generation provider should be configurable (currently SerpAPI).

## 3. Non-Functional Requirements

### 3.1. Performance
* **NFR-PERF-01:** Frontend UI must be responsive (<200ms feedback).
* **NFR-PERF-02:** Page load times should be optimized (< 3 seconds).
* **NFR-PERF-03:** Backend API response times for synchronous requests should be < 500ms.
* **NFR-PERF-04:** Asynchronous job processing time will vary but the system must remain responsive.

### 3.2. Scalability
* **NFR-SCALE-01:** The architecture must support horizontal scaling.
* **NFR-SCALE-02:** The database schema must be designed for efficient queries with growing data.

### 3.3. Reliability & Availability
* **NFR-REL-01:** The system should aim for high availability (>99.5% uptime).
* **NFR-REL-02:** Background job processing must include automatic retries for transient failures.
* **NFR-REL-03:** Graceful degradation should be implemented for various failure scenarios.
* **NFR-REL-04:** Regular database backups must be performed.
* **NFR-REL-05:** Idempotency checks should be implemented in critical jobs.

### 3.4. Usability
* **NFR-USE-01:** The user interface must be intuitive and easy to navigate.
* **NFR-USE-02:** Clear instructions and feedback must be provided throughout.
* **NFR-USE-03:** Design and interaction patterns must be consistent.

### 3.5. Maintainability
* **NFR-MAIN-01:** Code must be well-structured, documented, and follow consistent standards.
* **NFR-MAIN-02:** The architecture should be modular for independent development.
* **NFR-MAIN-03:** Automated tests should be implemented for quality assurance.
* **NFR-MAIN-04:** Large code files should be refactored into smaller, focused modules.
* **NFR-MAIN-05:** Worker processes must be restarted after code changes.
* **NFR-MAIN-06:** Dependency versions must be explicitly tracked and documented.

### 3.6. Security
* **NFR-SEC-01:** Secure user authentication and session management must be implemented.
* **NFR-SEC-02:** Passwords must be securely hashed (bcrypt).
* **NFR-SEC-03:** Protection against common web vulnerabilities must be implemented.
* **NFR-SEC-04:** API endpoints must have appropriate authentication checks.
* **NFR-SEC-05:** API keys and secrets must be stored securely.

## 4. UI/UX Requirements
* **UIUX-01:** Implement a clean, modern interface with Tailwind CSS and shadcn/ui.
* **UIUX-02:** Ensure responsive design across device sizes.
* **UIUX-03:** Utilize smooth animations via Framer Motion to enhance experience.
* **UIUX-04:** Provide clear visual feedback for loading states, progress, and errors.
* **UIUX-05:** Follow accessibility best practices (WCAG AA).

## 5. External API Integrations

### 5.1. Google Gemini
* **Model:** gemini-1.5-flash-exp
* **Purpose:** Primary AI for content analysis and structure generation
* **Methods:** Text generation, semantic analysis

### 5.2. OpenAI
* **Model:** gpt-4o-mini
* **Purpose:** Fallback AI for content analysis and structure generation
* **Methods:** Text completion/generation

### 5.3. ElevenLabs
* **Model:** eleven_multilingual_v2
* **Purpose:** Audio transcription for uploaded audio files
* **Methods:** Speech-to-text transcription

### 5.4. SerpAPI
* **Engine:** google_images
* **Purpose:** Image search for visual elements
* **Methods:** Image search based on AI-generated queries

## 6. Future Considerations
* Collaborative note editing and sharing
* Advanced search capabilities (semantic search)
* Dark mode support
* User preferences and settings page
* Spaced Repetition System for flashcards
* Mind map generation from notes
* Browser extension for easier content import
* Progressive Web App features (offline access)
* Gamification elements
* Integration with other learning platforms or calendars 