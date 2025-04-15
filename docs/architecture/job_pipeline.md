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