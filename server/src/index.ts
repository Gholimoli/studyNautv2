import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { authRoutes } from './modules/auth/routes/auth.routes'; // Import auth routes
import { mediaRoutes } from './modules/media/routes/media.routes'; // Import media routes
import passport from 'passport'; // Import passport
import { configurePassport } from './core/config/passport'; // Import passport config
import session from 'express-session'; // Import express-session
import connectPgSimple from 'connect-pg-simple'; // Import pg session store
import { notesRoutes } from './modules/notes/routes/notes.routes';
import { ocrRoutes } from './modules/ocr/ocr.routes'; // Import OCR routes
import { folderRoutes } from './modules/folders/folders.routes'; // Import Folder routes

configurePassport(); // Configure Passport strategies

const app: Express = express();
const port = process.env.PORT || 3001;
const PgSession = connectPgSimple(session);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for session store.');
}
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET environment variable not set. Using default, insecure secret.');
}

// Middleware
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware Configuration
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session', // Optional: customize table name
    createTableIfMissing: true, // Automatically create session table
  }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-key', // Use env var or fallback
  resave: false,
  saveUninitialized: false, // Don't save sessions until something is stored
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevent client-side access
    sameSite: 'lax' // Adjust as needed for CORS setup
  }
}));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session()); // Enable session support for Passport

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// API Routes
app.use('/api/auth', authRoutes); // Mount auth routes
app.use('/api/media', mediaRoutes); // Mount media routes
app.use('/api/notes', notesRoutes);
app.use('/api/ocr', ocrRoutes); // Mount OCR routes
app.use('/api/folders', folderRoutes); // Mount Folder routes
// TODO: Add other module routes (notes, etc.)

// Add global error handler middleware (must be after all routes)
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const userId = (req.user as any)?.id || 'anonymous'; // Get user ID if available

  // Log structured error information
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message: message,
    status: status,
    method: req.method,
    url: req.originalUrl,
    userId: userId,
    stack: err.stack, // Log the stack trace
    // Optionally add err.code or other specific error properties
  }, null, 2)); // Pretty print JSON for readability in console

  res.status(status).json({
    message: message,
    // Only include detailed error in development
    error: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
  });
});

// Start server
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
