"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRoutes = void 0;
const express_1 = require("express");
const media_controller_1 = require("../controllers/media.controller");
const auth_middleware_1 = require("../../../core/middleware/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const os_1 = __importDefault(require("os"));
const db_1 = require("../../../core/db");
const schema_1 = require("../../../core/db/schema");
const queue_1 = require("../../../core/jobs/queue");
const job_definition_1 = require("../../../core/jobs/job.definition"); // Ensure JobType is imported if needed later
// --- Async Handler Utility ---
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// --- End Async Handler Utility ---
// --- Multer Configuration for File Uploads (Audio & PDF) ---
const MAX_FILE_SIZE_MB = 100; // Shared limit for now
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIMETYPES = [
    // Audio types
    'audio/mpeg', // .mp3
    'audio/wav', // .wav
    'audio/wave',
    'audio/x-wav',
    'audio/ogg', // .ogg
    'audio/aac', // .aac
    'audio/webm', // .webm (often audio/video, but can be audio)
    'audio/mp4', // .mp4, .m4a (can be audio-only)
    'audio/x-m4a',
    // PDF type
    'application/pdf', // .pdf
    // Image types
    'image/png',
    'image/jpeg',
    'image/webp',
    // Add other image types if needed (e.g., 'image/gif')
];
const upload = (0, multer_1.default)({
    dest: os_1.default.tmpdir(), // Store temporarily first
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only specific audio and PDF files are allowed.`));
        }
    },
});
// --- End Multer Configuration ---
const router = (0, express_1.Router)();
// All media routes require authentication
router.use(auth_middleware_1.ensureAuthenticated);
// Wrap async handler for /text
router.post('/text', asyncHandler(media_controller_1.mediaController.processText));
// POST /api/media/upload for audio/PDF files
router.post('/upload', (req, res, next) => {
    console.log(`[Route /upload] Request received. Headers:`, req.headers);
    console.log(`[Route /upload] Content-Type: ${req.get('content-type')}`);
    next(); // Pass control to the next middleware (Multer)
}, upload.single('file'), // Multer middleware
(req, res, next) => {
    console.log(`[Route /upload] After Multer. req.file exists: ${!!req.file}`);
    if (req.file) {
        console.log(`[Route /upload] req.file details:`, {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
        });
    }
    if (!req.file) {
        console.warn('[Route /upload] req.file is MISSING after Multer ran!');
    }
    next(); // Pass control to the asyncHandler and controller
}, asyncHandler(media_controller_1.mediaController.handleFileUpload));
// POST /api/media/pdf-url
// Uses the specific processPdfUrl controller method
router.post('/pdf-url', asyncHandler(media_controller_1.mediaController.processPdfUrl));
// POST /api/media/youtube
router.post('/youtube', asyncHandler((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        if (!user || !user.id) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        const userId = user.id;
        const { url } = req.body;
        if (!url || typeof url !== 'string' || !/^https?:\/\/(www\.)?youtube\.com\/.+|youtu\.be\/.+/.test(url)) {
            return res.status(400).json({ message: 'A valid YouTube URL is required.' });
        }
        // Insert new source
        const newSource = {
            userId,
            sourceType: 'YOUTUBE',
            originalUrl: url,
            processingStatus: 'PENDING',
            processingStage: 'TRANSCRIPTION_PENDING',
            metadata: {},
        };
        const insertedSources = yield db_1.db.insert(schema_1.sources).values(newSource).returning({ id: schema_1.sources.id });
        if (!insertedSources || insertedSources.length === 0 || !insertedSources[0].id) {
            throw new Error('Failed to insert source record into database.');
        }
        const sourceId = insertedSources[0].id;
        yield queue_1.noteProcessingQueue.add(job_definition_1.JobType.PROCESS_AUDIO_TRANSCRIPTION, { sourceId });
        res.status(201).json({
            sourceId,
            message: 'YouTube video submitted successfully. Transcript extraction and note generation have started.'
        });
    }
    catch (error) {
        console.error('[YouTubeRoute] Error in /youtube handler:', error);
        next(error);
    }
})));
// --- End POST /api/media/youtube ---
exports.mediaRoutes = router;
