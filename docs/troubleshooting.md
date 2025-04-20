# Troubleshooting Guide

This guide addresses common issues encountered in the Studynaut application and provides solutions for local development.

## Development Environment Issues

### Node.js and pnpm Issues

*   **Problem**: `pnpm command not found`
    *   **Solution**: Install pnpm globally with `npm install -g pnpm`.
*   **Problem**: Dependency installation fails
    *   **Solution**: Ensure you are in the project root directory. Clear pnpm cache with `pnpm store prune` and try `pnpm install` again.
    *   **Solution**: Check Node.js version compatibility (v18+ recommended). Use nvm if needed (`nvm use 18`).

### TypeScript and Build Errors

*   **Problem**: TypeScript compilation errors during build (`pnpm build` in `server` or `client`).
    *   **Solution**: Check the terminal output for specific file and line numbers.
    *   **Solution**: Run `pnpm tsc --noEmit` within the specific package (`server` or `client`) to identify errors before a full build.
    *   **Solution**: Ensure `@shared` types are correctly built or referenced if changes were made there.
*   **Problem**: Path aliases (`@/`, `@server/`, `@client/`, `@shared/`) not resolving.
    *   **Solution**: Verify `tsconfig.json` (`baseUrl` and `paths`) configuration in the relevant package (`server/tsconfig.json`, `client/tsconfig.json`) matches the project structure.
    *   **Solution**: Restart the TypeScript language server in your IDE (often requires reloading the window).
    *   **Solution**: Ensure the build process (`tsc`) has run if types depend on generated output.

## Database Issues (PostgreSQL)

### Connection Problems

*   **Problem**: `ECONNREFUSED` or similar connection error when starting the server.
    *   **Solution**: Verify your PostgreSQL server is running. Use `pg_isready` or check its service status.
    *   **Solution**: Double-check the `DATABASE_URL` in `server/.env`. Ensure the username, password, host, port, and database name are correct.
    *   **Solution**: Check firewall rules if PostgreSQL is running on a different machine or container.
    *   **Solution**: If using Docker, ensure the PostgreSQL container is running and the port mapping is correct.

### Migration Failures

*   **Problem**: `pnpm db:migrate:dev` fails.
    *   **Solution**: Check the terminal output for specific SQL errors or migration file issues.
    *   **Solution**: Ensure the database specified in `DATABASE_URL` exists and the user has sufficient privileges.
    *   **Solution**: If you manually edited SQL migration files, check for syntax errors.
    *   **Solution**: Sometimes, resetting the development database and re-applying migrations is the easiest fix ( **Use with caution, data will be lost!** ).

### Drizzle ORM Issues

*   **Problem**: Drizzle schema validation errors or type mismatches during development.
    *   **Solution**: Ensure `server/src/db/schema.ts` accurately reflects the desired database state.
    *   **Solution**: Run `pnpm db:generate` in the `server` directory to create new migration files reflecting schema changes.
    *   **Solution**: Apply migrations using `pnpm db:migrate:dev`.
*   **Problem**: `Unknown column '<column_name>' in field list` or similar runtime query errors.
    *   **Solution**: Ensure the latest database migrations have been applied (`pnpm db:migrate:dev`).
    *   **Solution**: Verify that your Drizzle query code (`db.select()...`) correctly uses column names defined in `schema.ts`.

## Redis and Job Queue Issues (BullMQ)

### Redis Connection Errors

*   **Problem**: `ECONNREFUSED` or connection errors related to Redis when starting the server or worker.
    *   **Solution**: Verify your Redis server is running (`redis-cli ping` should return `PONG`).
    *   **Solution**: Check the `REDIS_URL` in `server/.env` is correct.
    *   **Solution**: If using Docker, ensure the Redis container is running and the port mapping is correct.

### BullMQ Worker Issues

*   **Problem**: Changes to worker code (`server/src/worker.ts` or its dependencies) don't take effect.
    *   **Solution**: **CRITICAL** - You *must* manually restart the backend development process (`Ctrl+C` in the server terminal, then `pnpm dev`). The running worker process does not automatically pick up code changes.
*   **Problem**: Jobs are added to the queue (visible via API or Redis inspection) but never seem to get processed (stay in `waiting` state).
    *   **Solution**: Verify the worker process is actually running (check the terminal logs from `pnpm dev` in the `server` directory).
    *   **Solution**: Check for errors during worker startup in the terminal logs. Connection issues (DB, Redis) or errors in processor function imports can prevent the worker from starting correctly.
    *   **Solution**: Add extensive `console.log` statements at the beginning of your worker process (`worker.ts`) and inside specific job processors (`core/jobs/*.job.ts`) to trace execution.
*   **Problem**: Jobs fail immediately or unexpectedly.
    *   **Solution**: Check the worker logs for error messages related to the specific job processor.
    *   **Solution**: Add `try...catch` blocks within your job processor functions and log errors with `job.data` for context.
    *   **Solution**: Ensure all necessary services or external clients (DB, AI providers) are correctly initialized within the worker context.
*   **Problem**: Clearing stuck jobs (Development Only).
    *   **Solution**: Use a Redis client (`redis-cli`) to inspect queues (`KEYS bull:*:*`, `LRANGE bull:<queue_name>:waiting 0 -1`). You can flush the *entire* Redis instance with `FLUSHALL` ( **Use with extreme caution - all Redis data will be lost!** ). Alternatively, use `redis-cli DEL key1 key2 ...` to remove specific BullMQ queue keys (e.g., `bull:note-processing:active`, `bull:note-processing:wait`, etc.).
*   **Problem**: Jobs fail with `TypeError: ... is not a constructor`
    *   **Solution**: Check for ESM/CJS import issues in worker files
    *   **Solution**: Try restarting the worker and server
*   **Problem**: Job fails with `Storage path missing in metadata for source X`
    *   **Cause**: The job expected the Supabase file path in `source.metadata.storagePath`, but it was missing or stored elsewhere (e.g., `source.originalStoragePath`).
    *   **Solution**: Ensure the service creating the `source` record (e.g., `MediaService`) correctly saves the path to `metadata.storagePath`. Restart the server process after fixing.
*   **Problem**: Job fails with `ENOENT: no such file or directory` when processing a file (e.g., `stat 'user_X/audio/...'` fails).
    *   **Cause**: The job is treating a cloud storage path (Supabase path) as a local filesystem path. Files in cloud storage must be explicitly downloaded first.
    *   **Solution**: Modify the job logic (`processAudioTranscriptionJob` in this case) to use `StorageService.downloadFile` to download the file from Supabase to a temporary local path *before* attempting to process it. Ensure the temporary file is deleted afterwards (using a `finally` block).
*   **Problem**: Handlebars `TypeError: options.inverse is not a function` during job processing (e.g., `ASSEMBLE_NOTE` job).
    *   **Cause**: A Handlebars helper designed for block usage (`{{#helper}}...{{/helper}}`) is likely being called inline (`{{helper}}` or within another expression like `{{#if (helper ...)}}`). In inline calls, the `options` object isn't passed correctly, causing the error when `options.inverse` is accessed.
    *   **Solution 1**: Find the incorrect inline usage in the templates (`.hbs` files) using `grep -R --line-number --color -E '{{\s*(eq|findVisual|ne|not|and|or)\b' src/templates` (adjust helper names as needed) and change it to the block form (`{{#helper}}...{{/helper}}`).
    *   **Solution 2**: Modify the helper implementation in the job file (e.g., `assembleNote.job.ts`) to be robust. Check if `options && typeof options.fn === 'function'` to determine if it's a block call. Handle both inline (e.g., return a boolean or value) and block (call `options.fn(this)` or `options.inverse(this)`) scenarios.
*   **Problem**: BullMQ job retry (`job.retry()`) seems ineffective; job remains in `failed` state.
    *   **Cause 1**: The job might be failing again immediately after being retried, faster than the state can be observed externally.
    *   **Cause 2**: Potential state inconsistency or lock associated with the specific job ID in Redis.
    *   **Cause 3**: Maximum retry attempts for the job may have been exceeded.
    *   **Solution**: Verify the job state directly in Redis (`redis-cli ZSCORE bull:<queue_name>:failed <job_id>`) after attempting a retry. Check worker logs immediately. Consider using a script to explicitly delete the problematic job (`job.remove()`) and resubmitting the original task.
*   **Problem**: `PROCESS_VISUAL_PLACEHOLDERS` job reports "No visual placeholders found" but they exist in the AI structure.
    *   **Cause**: The placeholder detection logic (e.g., `findVisualPlaceholders` function) might be too strict, requiring fields (like `description`) that are sometimes omitted by the AI provider within the placeholder block itself (expecting them only in the top-level `visualOpportunities` array).
    *   **Solution**: Add logging before the detection function runs to inspect the raw AI structure. Modify the detection function to be less strict (e.g., only check for `contentType: 'visual_placeholder'` and `placeholderId`). Ensure the job logic correctly fetches details like `description` from the `visualOpportunities` array using the `placeholderId`.
*   **Problem**: `ASSEMBLE_NOTE` job runs before `GENERATE_VISUAL` jobs complete, resulting in missing images.
    *   **Cause**: The job dependency logic is flawed. `ASSEMBLE_NOTE` might be enqueued prematurely (e.g., by `PROCESS_VISUAL_PLACEHOLDERS` directly) or the completion check in `GENERATE_VISUAL` is not working correctly.
    *   **Solution**: Ensure `ASSEMBLE_NOTE` is *only* triggered by the *last* completing `GENERATE_VISUAL` job for a given `sourceId`. This typically involves:
        *   `PROCESS_VISUAL_PLACEHOLDERS` setting a specific `sources.processingStage` (e.g., `GENERATING_VISUALS`).
        *   Each `GENERATE_VISUAL` job counting remaining pending/processing visuals for the source.
        *   The *last* `GENERATE_VISUAL` job (when the count reaches 0) verifying the source stage is still `GENERATING_VISUALS` before enqueueing `ASSEMBLE_NOTE` and updating the source stage (e.g., to `ASSEMBLY_PENDING`).
        *   Clearing any stuck/prematurely added jobs from the queue (`redis-cli DEL ...`).
*   **Problem**: Images appear broken in the final note despite successful visual generation.
    *   **Cause**: The image URL obtained from the external search might be temporary, protected, or otherwise unsuitable for direct embedding (e.g., `lookaside.fbsbx.com` URLs from Facebook/Meta).
    *   **Solution**: Add debug output to the rendering template (e.g., `visual.hbs`) to display the `imageUrl`. Check if the URL itself is accessible directly in a browser. Implement filtering in the `GENERATE_VISUAL` job's image selection logic to discard URLs from known problematic domains.

## API Integration Issues

*   **Problem**: `4xx` or `5xx` errors related to external APIs (Gemini, OpenAI, SerpAPI, ElevenLabs).
    *   **Solution**: **Verify API Keys:** Double-check the exact key values in `server/.env`. Ensure no extra spaces, quotes, or characters are present.
    *   **Solution**: **Check API Key Status:** Visit the respective provider's dashboard (Google AI Studio, OpenAI Platform, SerpAPI, ElevenLabs) to ensure the key is active, has the necessary permissions/APIs enabled, and has sufficient credits/quota.
    *   **Solution**: **Log Request/Response:** Temporarily add logging within the provider implementation (`server/src/modules/ai/providers/` or `utils/`) to see the exact request being sent and the raw error response received from the API.
    *   **Solution**: **Check Provider Libraries:** Ensure the correct SDKs/libraries are installed (`@google/generative-ai`, `openai`, `serpapi`, etc.).

### OpenAI API

### OCR Provider Issues (Mistral/Gemini)

- **Problem**: PDF processing fails with Mistral error (e.g., 520 Cloudflare error).
  - **Solution**: This seems to be an intermittent issue with the Mistral API when processing raw PDF buffers. The system is designed to automatically fall back to the Gemini provider, which should succeed. Monitor worker logs for confirmation of fallback.

- **Problem**: Image processing fails with Mistral error (e.g., 422 Unprocessable Entity).
  - **Solution**: This appears to be an issue with how Mistral handles `data_uri` for images via its API. The system will automatically fall back to the Gemini provider, which handles images correctly. Monitor worker logs for confirmation.

- **Problem**: OCR fallback doesn't seem to trigger (worker throws error like "Primary provider returned null...").
  - **Solution**: Ensure `FALLBACK_OCR_PROVIDER=gemini` is correctly set in `server/.env` (note: key is `gemini`, not a specific model). Verify `GEMINI_API_KEY` is also set. Restart the worker process after checking `.env`.

### SerpAPI

## Frontend Issues (`client/`)

### Vite Development Server

*   **Problem**: `EADDRINUSE` port conflict when running `pnpm dev`.
    *   **Solution**: Stop any other process using the default Vite port (usually 5173). Check `vite.config.ts` for the configured port.
*   **Problem**: Hot Module Replacement (HMR) not working (changes don't reflect automatically).
    *   **Solution**: Check the browser's developer console for errors.
    *   **Solution**: Check the terminal running `pnpm dev` in the `client` directory for errors.
    *   **Solution**: Try a hard refresh in the browser (`Cmd+Shift+R` or `Ctrl+Shift+R`).
    *   **Solution**: Restart the Vite dev server.

### React Component / TanStack Query Issues

*   **Problem**: Data not loading, components stuck in loading state.
    *   **Solution**: Check the browser's Network tab to see if the API request to the backend (`http://localhost:3001/api/...` or similar) is being made correctly.
    *   **Solution**: Verify the API request is successful (Status 2xx) and the response data is as expected.
    *   **Solution**: Check the backend server logs for errors related to the specific API endpoint.
    *   **Solution**: Ensure the TanStack Query key used in `useQuery` is correct and consistent.
    *   **Solution**: Use React DevTools and TanStack Query DevTools to inspect component state and query cache.
*   **Problem**: API calls fail with CORS errors.
    *   **Solution**: Ensure the backend server (`server/src/server.ts`) has correctly configured CORS middleware (`cors` package) to allow requests from the frontend origin (`http://localhost:5173`).
    *   **Solution**: Verify the `proxy` setting in `client/vite.config.ts` if you are using Vite's proxy feature.
*   **Problem**: Note Detail page shows "No content available" or renders raw HTML tags instead of formatted content.
    *   **Cause**: Mismatch between backend data format and frontend rendering. The backend saves pre-rendered HTML (`htmlContent`), but the frontend component (`NoteDetailPage.tsx` or similar) is attempting to render Markdown (`markdownContent`) using a library like `react-markdown`.
    *   **Solution**: Modify the frontend note detail component. Remove the Markdown rendering logic. Fetch the note data ensuring the `htmlContent` field is available. Render this field using `dangerouslySetInnerHTML={{ __html: note.htmlContent || '' }}` on a container element (e.g., a `div`). Ensure appropriate styling (e.g., using Tailwind Typography `prose` classes) is applied to the container for correct HTML rendering.

## Debugging Tips

*   **Logging:** Use `console.log` extensively, especially in the backend API handlers, services, and worker job processors. Prefix logs to identify their origin.
*   **Browser DevTools:** Use the Network tab (check request/response headers and bodies), Console tab (check for frontend errors), and Application tab (check cookies, local storage).
*   **React DevTools:** Inspect component hierarchy, props, and state.
*   **TanStack Query DevTools:** Inspect query cache, status, and data.
*   **Database Client:** Connect directly to your PostgreSQL database using a tool like `psql`, DBeaver, or TablePlus to inspect table data and verify results.
*   **Redis Client:** Use `redis-cli` to inspect queue states.
*   **API Client:** Use tools like Postman, Insomnia, or `curl` to test backend API endpoints directly, bypassing the frontend.

## Restart Procedures

*   **Frontend:** Stop (`Ctrl+C`) and restart `pnpm dev` in the `client` directory.
*   **Backend (API + Worker):** Stop (`Ctrl+C`) and restart `pnpm dev` in the `server` directory. **Remember this is necessary for worker code changes.**
*   **Full System:** Stop both frontend and backend processes. Optionally restart Docker containers (Postgres, Redis) if used. Then restart backend, then frontend. 