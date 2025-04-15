## Mistral OCR Pipeline (2025-04-15)
- The backend supports OCR for both images and PDFs using Mistral as the primary provider.
- Images are sent as base64-encoded data URIs to the /v1/ocr endpoint.
- PDFs are uploaded, signed URLs are obtained, and then processed via the same endpoint.
- Robust error handling, logging, and cleanup are implemented throughout the pipeline.
- Provider fallback logic is in place for reliability.
- Implementation matches Mistral's latest documentation and supports both file types end-to-end.

*   **`StorageService` (`server/src/core/services/storage.service.ts`)**: Handles interactions with Supabase Storage. Provides methods for uploading (`uploadFile`), generating signed URLs (`getSignedUrl`), deleting (`deleteFile`), and downloading (`downloadFile`) files from the designated bucket (e.g., `originalaudio`).

*   **`AiService` (`server/src/modules/ai/ai.service.ts`)**: Central orchestrator for AI tasks (lesson structure, quiz, flashcards). Manages primary/fallback/visual AI providers based on configuration. 