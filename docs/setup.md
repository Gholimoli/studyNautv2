# Setup Guide

This guide describes how to set up the Studynaut project for local development.

## Prerequisites

Ensure you have the following installed on your system:

*   **Node.js:** Version 18.x or later (check with `node -v`). We recommend using [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to manage Node.js versions.
*   **pnpm:** The package manager used for this monorepo (check with `pnpm -v`). Install via `npm install -g pnpm`.
*   **PostgreSQL:** A running PostgreSQL server (version 14+ recommended). You need database creation privileges.
*   **Redis:** A running Redis server (used for the BullMQ job queue).
*   **Git:** For cloning the repository.
*   **(Optional) Docker & Docker Compose:** If you prefer running PostgreSQL and Redis in containers.

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd studynaut-project # Or your repository directory name
```

## 2. Install Dependencies

Navigate to the project root directory and install dependencies for all packages (client, server, shared) using pnpm:

```bash
pnpm install
```

## 3. Environment Variables (`server/.env`)

The backend server requires environment variables for configuration, especially API keys and database connection details.

1.  **Copy the example file:**
    ```bash
    cd server
    cp .env.example .env
    ```

2.  **Edit `server/.env`** and fill in the required values:

    *   `DATABASE_URL`: The connection string for your PostgreSQL database.
        *   Format: `postgresql://<user>:<password>@<host>:<port>/<database_name>?schema=public`
        *   Example: `postgresql://studynaut_user:password@localhost:5432/studynaut_db?schema=public`
    *   `REDIS_URL`: The connection string for your Redis server.
        *   Example: `redis://localhost:6379`
    *   `SESSION_SECRET`: A long, random string used to sign session cookies. Generate one using a password generator.
    *   `GEMINI_API_KEY`: Your API key for the Google Gemini API.
    *   `OPENAI_API_KEY`: Your API key for the OpenAI API.
    *   `ELEVENLABS_API_KEY`: Your API key for the ElevenLabs API.
    *   `SERPAPI_API_KEY`: Your API key for the SerpAPI service.
    *   `PRIMARY_AI_PROVIDER`: `gemini` or `openai` (or other implemented providers)
    *   `FALLBACK_AI_PROVIDER`: `openai` or `gemini` (or other implemented providers)
    *   `VISUAL_AI_PROVIDER`: `serpapi` (or other implemented visual providers)
    *   `APP_BASE_URL`: The base URL for the frontend (e.g., `http://localhost:5173`)
    *   `SERVER_PORT`: Port for the backend server (default: `3001`)

## 4. Set Up the Database

1.  **Create the Database:** Ensure your PostgreSQL server is running and create the database specified in your `DATABASE_URL`.
    ```bash
    # Example using psql
    psql -U postgres -c "CREATE DATABASE studynaut_db;"
    # You might need to create the user and grant privileges as well
    # psql -U postgres -c "CREATE USER studynaut_user WITH PASSWORD 'password';"
    # psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE studynaut_db TO studynaut_user;"
    ```

2.  **Run Database Migrations:** Apply the database schema defined in `server/src/db/schema.ts` using Drizzle Kit migrations.
    ```bash
    cd server
    pnpm db:migrate:dev
    ```
    *   This command applies any pending migrations found in `server/src/db/migrations/`.
    *   If you encounter issues, you might need to generate migrations first (`pnpm db:generate`) after defining your initial schema.

## 5. Running the Application

You need to run two separate processes: the backend server (including the worker) and the frontend development server.

1.  **Start the Backend Server & Worker:**
    *   Navigate to the `server` directory.
    *   The `dev` script typically starts both the API server and the worker concurrently (using a tool like `concurrently` or `nodemon`). Check the `server/package.json` script definition.
    ```bash
    cd server
    pnpm dev
    ```
    *   This will usually:
        *   Compile TypeScript (`tsc -w` or similar).
        *   Start the API server (`node dist/server.js`).
        *   Start the Worker process (`node dist/worker.js`).
    *   Look for logs indicating the server is listening (e.g., on port 3001) and the worker is connected to Redis and waiting for jobs.

2.  **Start the Frontend Development Server:**
    *   Open a **new terminal**.
    *   Navigate to the `client` directory.
    *   Start the Vite development server.
    ```bash
    cd client
    pnpm dev
    ```
    *   Vite will output the local URL where the frontend is running (usually `http://localhost:5173`).

## 6. Accessing the Application

Open your web browser and navigate to the frontend URL provided by Vite (e.g., `http://localhost:5173`). You should see the Studynaut login page or dashboard.

## Development Workflow Notes

*   **Backend Changes:** Most changes to the API server code (`server/src/**/*.ts`, excluding `worker.ts`) should be automatically picked up by the development server (e.g., via `nodemon` or `tsc -w`).
*   **Worker Changes:** **IMPORTANT:** Any changes made to `server/src/worker.ts` or files directly imported *only* by the worker **require a manual restart** of the backend process (`Ctrl+C` in the server terminal, then `pnpm dev` again).
*   **Frontend Changes:** Changes to the frontend code (`client/src/**/*.tsx`) are typically handled by Vite's Hot Module Replacement (HMR) and should reflect in the browser almost instantly.
*   **Database Schema Changes:**
    1.  Modify `server/src/db/schema.ts`.
    2.  Generate migrations: `cd server && pnpm db:generate`.
    3.  Apply migrations: `cd server && pnpm db:migrate:dev`.
*   **Dependency Installation:** Run `pnpm install` in the root directory after pulling changes that modify `package.json` files. 