import { Router, Request, Response, NextFunction } from 'express';
import { mediaController } from '../controllers/media.controller';
import { ensureAuthenticated } from '@/core/middleware/auth.middleware';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { db } from '@/core/db';
import { sources } from '@/core/db/schema';
import { noteProcessingQueue } from '@/core/jobs/queue';

// --- Async Handler Utility ---
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
// --- End Async Handler Utility ---

// --- Multer Configuration for Audio Uploads ---
const MAX_AUDIO_SIZE_MB = 100; // Adjust as needed
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const ALLOWED_AUDIO_MIMETYPES = [
  'audio/mpeg', // .mp3
  'audio/wav',  // .wav
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',  // .ogg
  'audio/aac',  // .aac
  'audio/webm', // .webm (often audio/video, but can be audio)
  'audio/mp4',  // .mp4, .m4a (can be audio-only)
  'audio/x-m4a', // Added for M4A files
  // Add more as needed based on ElevenLabs/OpenAI support
];

const upload = multer({
  dest: os.tmpdir(), // Store temporarily first
  limits: { fileSize: MAX_AUDIO_SIZE_BYTES },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_AUDIO_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only audio files are allowed.`));
    }
  },
});
// --- End Multer Configuration ---

const router: Router = Router();

// All media routes require authentication
router.use(ensureAuthenticated);

// Wrap async handler for /text
router.post('/text', asyncHandler(mediaController.processText));

// POST /api/media/upload for audio files
// Ensure Multer middleware runs first, then the controller method
router.post('/upload', upload.single('file'), asyncHandler(mediaController.uploadAudio));

// POST /api/media/youtube
router.post('/youtube', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as { id: number } | undefined;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const userId = user.id;
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !/^https?:\/\/(www\.)?youtube\.com\/.+|youtu\.be\/.+/.test(url)) {
      return res.status(400).json({ message: 'A valid YouTube URL is required.' });
    }

    // Insert new source
    const newSource: typeof sources.$inferInsert = {
      userId,
      sourceType: 'YOUTUBE',
      originalUrl: url,
      processingStatus: 'PENDING',
      processingStage: 'TRANSCRIPTION_PENDING',
      metadata: {},
    };
    const insertedSources = await db.insert(sources).values(newSource).returning({ id: sources.id });
    if (!insertedSources || insertedSources.length === 0 || !insertedSources[0].id) {
      throw new Error('Failed to insert source record into database.');
    }
    const sourceId = insertedSources[0].id;
    await noteProcessingQueue.add('PROCESS_YOUTUBE_TRANSCRIPTION', { sourceId });
    res.status(201).json({
      sourceId,
      message: 'YouTube video submitted successfully. Transcript extraction and note generation have started.'
    });
  } catch (error) {
    console.error('[YouTubeRoute] Error in /youtube handler:', error);
    next(error);
  }
}));
// --- End POST /api/media/youtube ---

export const mediaRoutes = router; 