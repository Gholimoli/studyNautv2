## [Unreleased]

### Added
- Folder management functionality (create, fetch, delete).
- Basic note list filtering by folder.
- `PdfSubmissionModal` component for PDF uploads.
- Implemented PDF upload pipeline with UI integration and OCR fallback (Mistral -> Gemini).
- `ImageSubmissionModal` component for Image uploads.
- Implemented Image upload pipeline with UI integration and OCR fallback (Mistral -> Gemini).

### Changed
- Refactored media upload handling to use `useMediaMutations` hook.
- Updated `OcrService` fallback logic for robustness.
- Updated `AiService` to strip markdown fences from JSON responses.
- Corrected file filtering in `media.routes.ts` and `media.service.ts`.
- Corrected module path resolution for `storageService` in worker jobs.

### Fixed
- Addressed various issues related to OCR fallback triggering.
- Fixed JSON parsing errors from AI responses with markdown fences.
- Resolved server crashes related to incorrect module imports in worker.
- Fixed Handlebars rendering error (`TypeError: options.inverse is not a function`) in `ASSEMBLE_NOTE` job by making `eq` helper robust to null/undefined inputs and block vs. inline calls.
- Fixed note detail page displaying "No content available" by rendering `htmlContent` using `dangerouslySetInnerHTML` instead of attempting to render `markdownContent` with `ReactMarkdown`.

## [0.1.0] - 2025-XX-XX 

### Added
- Initial project setup with basic frontend/backend structure.
- User authentication (register, login, logout, status).
- Basic note creation from text input.
- Setup TanStack Query, Router, Tailwind, Shadcn UI.
- Core job queue setup with BullMQ and Redis.
- Initial AI service integration (Gemini, OpenAI). 