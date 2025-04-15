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
const auth_middleware_1 = require("@/core/middleware/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const os_1 = __importDefault(require("os"));
const db_1 = require("@/core/db");
const schema_1 = require("@/core/db/schema");
const queue_1 = require("@/core/jobs/queue");
// --- Async Handler Utility ---
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// --- End Async Handler Utility ---
// --- Multer Configuration for Audio Uploads ---
const MAX_AUDIO_SIZE_MB = 100; // Adjust as needed
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const ALLOWED_AUDIO_MIMETYPES = [
    'audio/mpeg', // .mp3
    'audio/wav', // .wav
    'audio/wave',
    'audio/x-wav',
    'audio/ogg', // .ogg
    'audio/aac', // .aac
    'audio/webm', // .webm (often audio/video, but can be audio)
    'audio/mp4', // .mp4, .m4a (can be audio-only)
    'audio/x-m4a', // Added for M4A files
    // Add more as needed based on ElevenLabs/OpenAI support
];
const upload = (0, multer_1.default)({
    dest: os_1.default.tmpdir(), // Store temporarily first
    limits: { fileSize: MAX_AUDIO_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_AUDIO_MIMETYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only audio files are allowed.`));
        }
    },
});
// --- End Multer Configuration ---
const router = (0, express_1.Router)();
// All media routes require authentication
router.use(auth_middleware_1.ensureAuthenticated);
// Wrap async handler for /text
router.post('/text', asyncHandler(media_controller_1.mediaController.processText));
// POST /api/media/upload for audio files
// Ensure Multer middleware runs first, then the controller method
router.post('/upload', upload.single('file'), asyncHandler(media_controller_1.mediaController.uploadAudio));
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
        yield queue_1.noteProcessingQueue.add('PROCESS_YOUTUBE_TRANSCRIPTION', { sourceId });
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
