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
import { JobType } from '@/core/jobs/job.definition'; // Ensure JobType is imported if needed later

// --- Async Handler Utility ---
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
// --- End Async Handler Utility ---

// --- Multer Configuration for File Uploads (Audio & PDF) ---
const MAX_FILE_SIZE_MB = 100; // Shared limit for now
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIMETYPES = [
  // Audio types
  'audio/mpeg', // .mp3
  'audio/wav',  // .wav
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',  // .ogg
  'audio/aac',  // .aac
  'audio/webm', // .webm (often audio/video, but can be audio)
  'audio/mp4',  // .mp4, .m4a (can be audio-only)
  'audio/x-m4a',
  // PDF type
  'application/pdf', // .pdf
  // Image types
  'image/png',
  'image/jpeg',
  'image/webp',
  // Add other image types if needed (e.g., 'image/gif')
];

const upload = multer({
  dest: os.tmpdir(), // Store temporarily first
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only specific audio and PDF files are allowed.`));
    }
  },
});
// --- End Multer Configuration ---

const router: Router = Router();

// All media routes require authentication
router.use(ensureAuthenticated);

// Wrap async handler for /text
router.post('/text', asyncHandler(mediaController.processText));

// POST /api/media/upload for audio/PDF files
router.post(
    '/upload', 
    (req: Request, res: Response, next: NextFunction) => {
        console.log(`[Route /upload] Request received. Headers:`, req.headers);
        console.log(`[Route /upload] Content-Type: ${req.get('content-type')}`);
        next(); // Pass control to the next middleware (Multer)
    },
    upload.single('file'), // Multer middleware
    (req: Request, res: Response, next: NextFunction) => {
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
    },
    asyncHandler(mediaController.handleFileUpload)
); 

// POST /api/media/pdf-url
// Uses the specific processPdfUrl controller method
router.post('/pdf-url', asyncHandler(mediaController.processPdfUrl)); 

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
    await noteProcessingQueue.add(JobType.PROCESS_AUDIO_TRANSCRIPTION, { sourceId });
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