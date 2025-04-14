# Database Architecture

This document describes the database schema, technologies, and design principles used in Studynaut.

## Technology

*   **Database System:** PostgreSQL (version 14+ recommended)
*   **ORM:** Drizzle ORM
*   **Schema Definition:** Drizzle Kit (TypeScript schema definition in `server/src/db/schema.ts`)
*   **Migrations:** Drizzle Kit (`drizzle-kit generate` and `drizzle-kit push` or `pnpm db:migrate` script)

## Schema Overview (`server/src/db/schema.ts`)

Below is a high-level overview of the core tables and their relationships. Refer to `schema.ts` for exact column types, constraints, and indexes.

### `users` Table

*   Stores user account information.
*   **Key Columns:**
    *   `id` (Primary Key, Serial/UUID)
    *   `username` (Unique, Text)
    *   `email` (Unique, Text)
    *   `hashedPassword` (Text)
    *   `displayName` (Text, Nullable)
    *   `avatarUrl` (Text, Nullable)
    *   `role` (Text, e.g., 'USER', 'ADMIN', Default: 'USER')
    *   `createdAt`, `updatedAt` (Timestamps)

### `sources` Table

*   Represents the original input material provided by the user.
*   **Key Columns:**
    *   `id` (Primary Key, Serial/UUID)
    *   `userId` (Foreign Key -> `users.id`)
    *   `sourceType` (Enum/Text: 'YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE')
    *   `originalUrl` (Text, Nullable - for YouTube)
    *   `originalFilename` (Text, Nullable - for uploads)
    *   `storagePath` (Text, Nullable - path to uploaded file if stored locally/cloud)
    *   `title` (Text, Nullable - user-provided or extracted)
    *   `textContent` (Text, Nullable - extracted text/transcript)
    *   `processingStatus` (Enum/Text: 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
    *   `processingStage` (Text, Nullable - current stage name, e.g., 'TRANSCRIBING', 'ANALYZING')
    *   `processingError` (Text, Nullable - error message if failed)
    *   `metadata` (JSONB, Nullable - e.g., YouTube video details, audio duration)
    *   `lessonStructureJson` (JSONB, Nullable - intermediate structured content from AI)
    *   `createdAt`, `updatedAt` (Timestamps)

### `notes` Table

*   Stores the final processed, structured notes generated from a source.
*   **Key Columns:**
    *   `id` (Primary Key, Serial/UUID)
    *   `userId` (Foreign Key -> `users.id`)
    *   `sourceId` (Foreign Key -> `sources.id`, Unique - one note per source)
    *   `title` (Text)
    *   `markdownContent` (Text)
    *   `htmlContent` (Text, optional - generated from markdown)
    *   `favorite` (Boolean, Default: false)
    *   `createdAt`, `updatedAt` (Timestamps)

### `visuals` Table

*   Stores information about visual elements identified and generated for notes.
*   **Key Columns:**
    *   `id` (Primary Key, Serial/UUID)
    *   `noteId` (Foreign Key -> `notes.id`)
    *   `sourceId` (Foreign Key -> `sources.id`) // Denormalized for easier lookup during assembly
    *   `placeholderId` (Text, Unique within note - e.g., `VISUAL::description_hash`)
    *   `description` (Text - description used for search/generation)
    *   `searchQuery` (Text - query sent to SerpAPI)
    *   `status` (Enum/Text: 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
    *   `imageUrl` (Text, Nullable - URL of the found/generated image)
    *   `errorMessage` (Text, Nullable)
    *   `createdAt`, `updatedAt` (Timestamps)

### `flashcards` Table

*   Stores flashcards generated for a note.
*   **Key Columns:**
    *   `id` (Primary Key, Serial/UUID)
    *   `noteId` (Foreign Key -> `notes.id`)
    *   `term` (Text)
    *   `definition` (Text)
    *   `createdAt`, `updatedAt` (Timestamps)

### `quizzes` Table

*   Stores quiz questions generated for a note.
*   **Key Columns:**
    *   `id` (Primary Key, Serial/UUID)
    *   `noteId` (Foreign Key -> `notes.id`)
    *   `question` (Text)
    *   `options` (JSONB Array of strings)
    *   `correctAnswerIndex` (Integer)
    *   `explanation` (Text, Nullable)
    *   `createdAt`, `updatedAt` (Timestamps)

*(Other tables like `sessions`, `user_preferences`, etc., might be added as needed.)*

## Relationships

*   One `user` can have many `sources`.
*   One `user` can have many `notes`.
*   One `source` results in exactly one `note`.
*   One `note` can have many `visuals`.
*   One `note` can have many `flashcards`.
*   One `note` can have many `quizzes`.

## Design Considerations

*   **Indexing:** Appropriate indexes are crucial for query performance, especially on foreign keys (`userId`, `sourceId`, `noteId`) and frequently queried columns (`processingStatus`, `sourceType`, `favorite`).
*   **JSONB Usage:** `JSONB` is used for flexible, unstructured data like `sources.metadata`, `sources.lessonStructureJson`, and `quizzes.options`. Queries involving JSONB fields might be less performant than querying standard columns.
*   **Normalization vs. Denormalization:** The schema aims for normalization, but some denormalization might occur for performance (e.g., potentially adding `sourceType` to `notes` for easier filtering).
*   **Cascading Deletes:** Consider `ON DELETE CASCADE` constraints where appropriate (e.g., deleting a `source` should likely delete its associated `note`, `visuals`, `flashcards`, `quizzes`). Use with caution.
*   **Large Text Fields:** Columns like `textContent`, `markdownContent`, `htmlContent` use the `text` type, suitable for large amounts of text.

## Migrations

*   Schema changes are managed using Drizzle Kit.
*   **Workflow:**
    1.  Modify the TypeScript schema definitions in `server/src/db/schema.ts`.
    2.  Generate SQL migration files: `pnpm db:generate` (or `npx drizzle-kit generate:pg --schema src/db/schema.ts --out src/db/migrations`).
    3.  Apply migrations to the development database: `pnpm db:migrate:dev` (or `npx drizzle-kit push:pg` for simple changes, or apply manually for production).
*   Migration files are stored in `server/src/db/migrations/` and should be committed to version control. 