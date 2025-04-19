"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = require("./modules/auth/routes/auth.routes"); // Import auth routes
const media_routes_1 = require("./modules/media/routes/media.routes"); // Import media routes
const passport_1 = __importDefault(require("passport")); // Import passport
const passport_2 = require("./core/config/passport"); // Import passport config
const express_session_1 = __importDefault(require("express-session")); // Import express-session
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple")); // Import pg session store
const notes_routes_1 = require("./modules/notes/routes/notes.routes");
const ocr_routes_1 = require("./modules/ocr/ocr.routes"); // Import OCR routes
const folders_routes_1 = require("./modules/folders/folders.routes"); // Import Folder routes
(0, passport_2.configurePassport)(); // Configure Passport strategies
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
const PgSession = (0, connect_pg_simple_1.default)(express_session_1.default);
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for session store.');
}
if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET environment variable not set. Using default, insecure secret.');
}
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Session Middleware Configuration
app.use((0, express_session_1.default)({
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
app.use(passport_1.default.initialize());
app.use(passport_1.default.session()); // Enable session support for Passport
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});
// API Routes
app.use('/api/auth', auth_routes_1.authRoutes); // Mount auth routes
app.use('/api/media', media_routes_1.mediaRoutes); // Mount media routes
app.use('/api/notes', notes_routes_1.notesRoutes);
app.use('/api/ocr', ocr_routes_1.ocrRoutes); // Mount OCR routes
app.use('/api/folders', folders_routes_1.folderRoutes); // Mount Folder routes
// TODO: Add other module routes (notes, etc.)
// Add global error handler middleware (must be after all routes)
app.use((err, req, res, next) => {
    var _a;
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'anonymous'; // Get user ID if available
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
