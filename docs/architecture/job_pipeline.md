## YouTube Pipeline (2024)
- Users submit YouTube URLs via dashboard or API.
- Transcript is extracted using youtube-transcript (with timestamps).
- Source is updated in DB; job enqueues Gemini note generation.
- Gemini model is selected via PRIMARY_AI_PROVIDER in .env.
- Visuals are generated and integrated as with other sources.
- Robust error handling and detailed logging for large/complex jobs.

### 2. `PROCESS_AUDIO_TRANSCRIPTION`

*   **Trigger:** Enqueued by `MediaService.createSourceFromAudioUpload` after successful Supabase upload.
*   **Input:** `{ sourceId: number }`
*   **Processor:** `processAudioTranscriptionJob` (`server/src/core/jobs/processAudioTranscription.job.ts`)
*   **Steps:**
    1.  Fetch `sources` record by `sourceId`.
    2.  Update status to `PROCESSING`, stage `TRANSCRIPTION_IN_PROGRESS`.
    3.  Extract Supabase `storagePath` from `source.metadata`.
    4.  **Download audio file from Supabase storage (`storagePath`) to a temporary local file using `StorageService.downloadFile`.**
    5.  Call `processAudioWithElevenLabs` (primary) with the **temporary local file path**.
        *   Handles chunking, ElevenLabs API calls, retries, and potential fallback to OpenAI for failed chunks internally.
    6.  If transcription succeeds:
        *   Update `sources` record:
            *   Set `extractedText` to the full transcript.
            *   Store word timestamps in `metadata.wordTimestamps` (if available).
            *   Track provider used in `metadata.transcriptionProvider`.
            *   Set status `PENDING`, stage `AI_ANALYSIS_PENDING`.
        *   Enqueue `PROCESS_SOURCE_TEXT` job.
    7.  If transcription fails:
        *   Update `sources` record status `FAILED`, stage `TRANSCRIPTION_FAILED`, store error message.
    8.  **Clean up (delete) the temporary local audio file.**
*   **Output:** Updates `sources` record (status, stage, extractedText, metadata), potentially enqueues `PROCESS_SOURCE_TEXT`.

### 3. `PROCESS_SOURCE_TEXT`

### 4. `PROCESS_VISUAL_PLACEHOLDERS`

*   **Trigger:** Enqueued by `PROCESS_SOURCE_TEXT` upon successful AI structure generation.
*   **Input:** `{ sourceId: number }`
*   **Processor:** `handleProcessVisualPlaceholdersJob` (`server/src/core/jobs/processVisualPlaceholders.job.ts`)
*   **Steps:**
    1.  Fetch `sources` record by `sourceId`.
    2.  Parse `lessonStructureJson` from `source.metadata`.
    3.  Recursively find all blocks with `contentType: 'visual_placeholder'` and extract their `placeholderId`.
    4.  If placeholders > 0:
        *   Create a map of visual details (`description`, `concept`, `searchQuery`) from the top-level `aiStructure.visualOpportunities` array, keyed by `placeholderId`.
        *   For each found placeholder:
            *   Retrieve its details from the `visualOpportunities` map.
            *   Create a new `visuals` record in the DB with status `PENDING_GENERATION` and the fetched details.
            *   Enqueue a `GENERATE_VISUAL` job with the `visualId`, `sourceId`, and fetched details.
        *   Update the `sources` record `processingStage` to `GENERATING_VISUALS`.
    5.  If placeholders == 0:
        *   Update the `sources` record `processingStage` to `ASSEMBLY_PENDING`.
*   **Output:** Creates `visuals` DB records, enqueues `GENERATE_VISUAL` jobs, updates `sources.processingStage`.

### 5. `GENERATE_VISUAL`

*   **Trigger:** Enqueued by `PROCESS_VISUAL_PLACEHOLDERS` for each visual opportunity.
*   **Input:** `{ visualId: number, sourceId: number, placeholderId: string, description: string, searchQuery: string }`
*   **Processor:** `generateVisualJob` (`server/src/core/jobs/generateVisual.job.ts`)
*   **Steps:**
    1.  Update `visuals` record status to `PROCESSING`.
    2.  Call image search utility (`searchImages`) using `searchQuery` (or `description` as fallback).
    3.  If search successful:
        *   Score image candidates against `description` (e.g., using `string-similarity`).
        *   Select the best image above a threshold.
        *   If best found, update `visuals` record: status `COMPLETED`, store `imageUrl`, `altText`, `sourceUrl`, `sourceTitle`.
        *   If no suitable image found, update `visuals` record: status `NO_IMAGE_FOUND`.
    4.  If search fails:
        *   Update `visuals` record: status `FAILED`, store error message.
    5.  **Completion Check:** Count remaining visuals for the `sourceId` with status `PENDING*` or `PROCESSING`.
    6.  If count is 0 **and** `sources.processingStage` is `GENERATING_VISUALS`:
        *   Enqueue `ASSEMBLE_NOTE` job for the `sourceId`.
        *   Update `sources.processingStage` to `ASSEMBLY_PENDING`.
*   **Output:** Updates `visuals` record (status, image details, error), potentially enqueues `ASSEMBLE_NOTE`, updates `sources.processingStage`.

### 6. `ASSEMBLE_NOTE`

*   **Trigger:** Enqueued by the *last* completing `GENERATE_VISUAL` job for a source (or potentially by `PROCESS_VISUAL_PLACEHOLDERS` if no visuals were found, though this path is currently disabled).
*   **Input:** `{ sourceId: number }`
*   **Processor:** `handleAssembleNoteJob` (`server/src/core/jobs/assembleNote.job.ts`)
*   **Steps:**
    1.  Fetch `sources` record.
    2.  Fetch all associated `visuals` records for the `sourceId`.
    3.  Parse `lessonStructureJson` from `source.metadata`.
    4.  **Hydrate Visuals:** Traverse the parsed structure. For each `visual_placeholder` block:
        *   Find the corresponding `visuals` record using `placeholderId`.
        *   If `visual.status` is `COMPLETED`, replace the block: `contentType` -> `visual`, add `imageUrl`, `altText`, etc.
        *   If `visual.status` is `FAILED` or `NO_IMAGE_FOUND`, replace the block: `contentType` -> `placeholder`, add `reason`.
        *   If `visual.status` is `PENDING*`/`PROCESSING` (shouldn't happen if triggered correctly), treat as failed/pending placeholder.
    5.  **Normalize Content Types:** Recursively normalize `contentType` strings (e.g., `visual_placeholder` -> `visual-placeholder`, `note_box` -> `note-box`).
    6.  Render the final HTML using Handlebars templates/partials based on the processed structure and hydrated visuals.
    7.  Create or update the `notes` record with the generated `htmlContent`, title, summary, etc.
    8.  Update the `sources` record: status `COMPLETED`, stage `Note Assembled`.
*   **Output:** Creates/updates `notes` record, updates `sources` record status/stage. 