## Mistral OCR Pipeline (2025-04-15)
- The backend supports OCR for both images and PDFs using Mistral as the primary provider.
- Images are sent as base64-encoded data URIs to the /v1/ocr endpoint.
- PDFs are uploaded, signed URLs are obtained, and then processed via the same endpoint.
- Robust error handling, logging, and cleanup are implemented throughout the pipeline.
- Provider fallback logic is in place for reliability.
- Implementation matches Mistral's latest documentation and supports both file types end-to-end.

*   **`StorageService` (`server/src/core/services/storage.service.ts`)**: Handles interactions with Supabase Storage. Provides methods for uploading (`uploadFile`), generating signed URLs (`getSignedUrl`), deleting (`deleteFile`), and downloading (`downloadFile`) files from the designated bucket (e.g., `originalaudio`).

*   **`AiService` (`server/src/modules/ai/ai.service.ts`)**: Central orchestrator for AI tasks (lesson structure, quiz, flashcards). Manages primary/fallback/visual AI providers based on configuration.

### Authentication & Authorization

*   **Login/Register:** Uses standard email/password or username/password. Passwords are hashed using `bcryptjs`.
*   **Session Management:** Uses `express-session` with a compatible store (e.g., `connect-redis` or database store) for persistent sessions via cookies.
*   **Auth Endpoints:** Dedicated routes in `server/src/routes/auth.routes.ts` handle registration, login, logout, and status checks.

### Error Handling

*   Uses a centralized error handling middleware (`server/src/middleware/error.middleware.ts`).
*   Custom `ApiError` class for consistent HTTP error responses.
*   Zod used for input validation in route handlers.

### 3.4. OCR Module (`server/src/modules/ocr`)
*   **Purpose:** Handles Optical Character Recognition (OCR) for images and PDFs.
*   **Key Components:**
    *   `ocr.service.ts`: Orchestrates OCR tasks, selects provider.
    *   `ocr.controller.ts`: Defines API endpoint handlers (likely integrated into `media.controller`).
    *   `providers/`: Contains implementations for different OCR providers (e.g., `mistral.provider.ts`).
        *   Providers implement the `IOcrProvider` interface defined in `server/src/types/ocr.types.ts` (handling file buffers and metadata).
    *   `ocr.utils.ts`: Helper functions for OCR tasks.
*   **Interfaces:** `IOcrProvider`, `OcrResult` (shared). 