# API Endpoints Documentation

This document provides a comprehensive listing of all API endpoints in the Studynaut application. All endpoints are prefixed with `/api` (exact prefix TBD, e.g., `/api/v1`). Authentication is typically required via session cookies managed by Passport.js.

## Authentication Endpoints

### POST `/auth/register`
*   **Description:** Register a new user.
*   **Request Body:**
    ```json
    {
      "username": "string",
      "email": "string",
      "password": "string",
      "displayName": "string" // optional
    }
    ```
*   **Response (Success 201):** User object (excluding password).
    ```json
    {
      "id": number,
      "username": "string",
      "email": "string",
      "displayName": "string",
      "role": "string"
    }
    ```
*   **Response (Error 400):** Validation errors.
*   **Response (Error 409):** Username or email already exists.

### POST `/auth/login`
*   **Description:** Authenticate a user and start a session.
*   **Request Body:**
    ```json
    {
      "username": "string",
      "password": "string"
    }
    ```
*   **Response (Success 200):** User object (excluding password).
    ```json
    {
      "id": number,
      "username": "string",
      "email": "string",
      "displayName": "string",
      "role": "string"
    }
    ```
*   **Response (Error 401):** Invalid credentials.

### POST `/auth/logout`
*   **Description:** End the user's session.
*   **Response (Success 204):** No content.

### GET `/auth/status`
*   **Description:** Check the current authentication status and get user info if logged in.
*   **Response (Success 200):**
    ```json
    {
      "authenticated": boolean,
      "user": {
        "id": number,
        "username": "string",
        "email": "string",
        "displayName": "string",
        "role": "string"
      } | null
    }
    ```

## Media/Source Endpoints

*(Requires Authentication)*

### POST `/media/upload`
*   **Description:** Upload a media file (audio, PDF, image) to initiate processing.
*   **Request:** Multipart form data.
    *   `file`: The file to upload.
    *   `type`: "AUDIO" | "PDF" | "IMAGE"
    *   `languageCode`: string (optional, for audio)
*   **Response (Success 201):**
    ```json
    {
      "sourceId": number,
      "message": "Upload successful, processing started."
    }
    ```
*   **Response (Error 400):** Invalid input or file type.

### POST `/media/youtube`
*   **Description:** Submit a YouTube URL to initiate processing.
*   **Request Body:**
    ```json
    {
      "url": "string"
    }
    ```
*   **Response (Success 201):**
    ```json
    {
      "sourceId": number,
      "message": "YouTube URL received, processing started."
    }
    ```
*   **Response (Error 400):** Invalid URL or unable to fetch transcript.

### POST `/media/text`
*   **Description:** Submit plain text to initiate processing.
*   **Request Body:**
    ```json
    {
      "text": "string",
      "title": "string" // optional
    }
    ```
*   **Response (Success 201):**
    ```json
    {
      "sourceId": number,
      "message": "Text received, processing started."
    }
    ```
*   **Response (Error 400):** Invalid input.

### GET `/media/sources`
*   **Description:** Get a list of all sources submitted by the authenticated user.
*   **Query Parameters:**
    *   `type`: Filter by SourceType (optional)
    *   `status`: Filter by ProcessingStatus (optional)
    *   `limit`: Number of results (default: 20)
    *   `offset`: Pagination offset (default: 0)
*   **Response (Success 200):**
    ```json
    {
      "sources": [
        {
          "id": number,
          "userId": number,
          "sourceType": "YOUTUBE" | "TEXT" | "AUDIO" | "PDF" | "IMAGE",
          "originalUrl": "string",
          "originalFilename": "string",
          "processingStatus": "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
          "processingStage": "string",
          "createdAt": "string", // ISO 8601
          "updatedAt": "string" // ISO 8601
        }
        // ... more sources
      ],
      "total": number
    }
    ```

### GET `/media/sources/:id`
*   **Description:** Get details of a specific source.
*   **Path Parameters:**
    *   `id`: Source ID (number)
*   **Response (Success 200):** Full source object including `metadata`, `processingError` etc.
*   **Response (Error 404):** Source not found or not owned by user.

### DELETE `/media/sources/:id`
*   **Description:** Delete a source and its associated data (note, visuals, etc.).
*   **Path Parameters:**
    *   `id`: Source ID (number)
*   **Response (Success 204):** No content.
*   **Response (Error 404):** Source not found or not owned by user.

## Notes Endpoints

*(Requires Authentication)*

### GET `/notes`
*   **Description:** Get a list of all generated notes for the authenticated user.
*   **Query Parameters:**
    *   `sourceType`: Filter by SourceType (optional)
    *   `favorite`: Filter by favorite status (true/false) (optional)
    *   `limit`: Number of results (default: 20)
    *   `offset`: Pagination offset (default: 0)
*   **Response (Success 200):**
    ```json
    {
      "notes": [
        {
          "id": number,
          "sourceId": number,
          "userId": number,
          "title": "string",
          "createdAt": "string", // ISO 8601
          "updatedAt": "string", // ISO 8601
          "sourceType": "YOUTUBE" | "TEXT" | "AUDIO" | "PDF" | "IMAGE",
          "favorite": boolean,
          "languageCode": "string" | null,
          "folderId": number | null,
          "tags": [{ "id": number, "name": "string" }] | null
        }
        // ... more notes
      ],
      "total": number
    }
    ```

### GET `/notes/:id`
*   **Description:** Get the full content of a specific note.
*   **Path Parameters:**
    *   `id`: Note ID (number)
*   **Response (Success 200):**
    ```json
    {
      "id": number,
      "sourceId": number,
      "userId": number,
      "title": "string",
      "markdownContent": "string",
      "htmlContent": "string", // Optional
      "createdAt": "string", // ISO 8601
      "updatedAt": "string", // ISO 8601
      "sourceType": "YOUTUBE" | "TEXT" | "AUDIO" | "PDF" | "IMAGE",
      "favorite": boolean,
      "originalTranscript": "string" // If applicable, from source.textContent
      // Potentially include associated visuals, flashcards, quiz info
    }
    ```
*   **Response (Error 404):** Note not found or not owned by user.

### PATCH `/notes/:id`
*   **Description:** Update editable fields of a note.
*   **Path Parameters:**
    *   `id`: Note ID (number)
*   **Request Body:**
    ```json
    {
      "favorite": boolean,
      "folderId": number | null
    }
    ```
*   **Response (Success 200):** Updated note summary.
    ```json
    {
      "id": number,
      "sourceId": number,
      "userId": number,
      "title": "string",
      "summary": "string" | null,
      "createdAt": "string",
      "updatedAt": "string",
      "favorite": boolean,
      "folderId": number | null,
      "markdownContent": "string" | null,
      "htmlContent": "string" | null,
      "languageCode": "string" | null,
      "sourceType": "YOUTUBE" | "TEXT" | "AUDIO" | "PDF" | "IMAGE" | null
    }
    ```
*   **Response (Error 400):** Invalid input.
*   **Response (Error 404):** Note not found or not owned by user.

### DELETE `/notes/:id`
*   **Description:** Delete a note.
*   **Path Parameters:**
    *   `id`: Note ID (number)
*   **Response (Success 204):** No content.
*   **Response (Error 404):** Note not found or not owned by user.

## Processing Status Endpoints

*(Requires Authentication)*

### GET `/processing/status/:sourceId`
*   **Description:** Get the current processing status for a given source ID. Useful for frontend polling.
*   **Path Parameters:**
    *   `sourceId`: Source ID (number)
*   **Response (Success 200):**
    ```json
    {
      "sourceId": number,
      "processingStatus": "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
      "processingStage": "string", // e.g., "ANALYZING_TEXT", "GENERATING_VISUALS"
      "processingError": "string" // if status is FAILED
      // Potentially add progress details if available (e.g., visuals completed/total)
    }
    ```
*   **Response (Error 404):** Source not found or not owned by user.

## Study Tools Endpoints

*(Requires Authentication)*

### GET `/study/flashcards/:noteId`
*   **Description:** Get all flashcards associated with a specific note.
*   **Path Parameters:**
    *   `noteId`: Note ID (number)
*   **Response (Success 200):**
    ```json
    {
      "flashcards": [
        {
          "id": number,
          "noteId": number,
          "term": "string",
          "definition": "string"
        }
        // ... more flashcards
      ]
    }
    ```
*   **Response (Error 404):** Note not found or not owned by user.

### GET `/study/quiz/:noteId`
*   **Description:** Get all quiz questions associated with a specific note.
*   **Path Parameters:**
    *   `noteId`: Note ID (number)
*   **Response (Success 200):**
    ```json
    {
      "questions": [
        {
          "id": number,
          "noteId": number,
          "question": "string",
          "options": ["string", "string", ...],
          "correctAnswerIndex": number,
          "explanation": "string" // Optional
        }
        // ... more questions
      ]
    }
    ```
*   **Response (Error 404):** Note not found or not owned by user.

## User Profile Endpoints

*(Requires Authentication)*

### GET `/user/profile`
*   **Description:** Get the profile information for the currently authenticated user.
*   **Response (Success 200):** User object (excluding password).

### PATCH `/user/profile`
*   **Description:** Update the profile information for the currently authenticated user.
*   **Request Body:**
    ```json
    {
      "displayName": "string", // optional
      "email": "string",         // optional
      "avatarUrl": "string"      // optional
    }
    ```
*   **Response (Success 200):** Updated user object (excluding password).
*   **Response (Error 400):** Invalid input.
*   **Response (Error 409):** Email already in use by another user.

### POST `/user/change-password`
*   **Description:** Change the password for the currently authenticated user.
*   **Request Body:**
    ```json
    {
      "currentPassword": "string",
      "newPassword": "string"
    }
    ```
*   **Response (Success 200):**
    ```json
    { "message": "Password updated successfully" }
    ```
*   **Response (Error 400):** Invalid input (e.g., new password too short).
*   **Response (Error 401):** Current password incorrect. 