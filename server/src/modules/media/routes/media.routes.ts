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

const router = Router();

// All media routes require authentication
router.use(ensureAuthenticated);

// Wrap async handler for /text
router.post('/text', asyncHandler(mediaController.processText));
// Add routes for /youtube, /upload later

// --- POST /api/media/upload ---
// Use asyncHandler to wrap the async logic
router.post('/upload', upload.single('file'), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  console.log('[UploadRoute] === Handling /upload request ===');
  try {
    // --- Type Assertions (Workaround) ---
    const file = req.file as Express.Multer.File | undefined;
    const user = (req as any).user as { id: number } | undefined;
    // --- End Type Assertions ---

    if (!file) {
      // Check if the error was due to file filter rejection (Multer adds error to req)
      if ((req as any).multerError) {
        console.error('[UploadRoute] Multer error:', (req as any).multerError);
        return res.status(400).json({ message: (req as any).multerError.message });
      }
      // Or if the filter simply rejected without an error object
      console.error('[UploadRoute] No file found or type rejected, req.file is missing.');
      return res.status(400).json({ message: 'No file uploaded or file type rejected.' });
    }

    if (!user || !user.id) {
      console.error('[UploadRoute] User object missing after ensureAuthenticated.');
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const userId = user.id;
    const { originalname, mimetype, path: tempPath, size } = file;
    const languageCode = req.body.languageCode as string | undefined;
    console.log(`[UploadRoute] User: ${userId}, File: ${originalname}, Type: ${mimetype}, Size: ${size}, Lang: ${languageCode}`);

    const persistentDir = path.resolve(__dirname, '../../../../uploads/audio', String(userId));
    const uniqueFilename = `${Date.now()}-${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const persistentPath = path.join(persistentDir, uniqueFilename);
    const relativeStoragePath = path.relative(path.resolve(__dirname, '../../../../'), persistentPath);

    let sourceId: number | undefined;

    await fs.mkdir(persistentDir, { recursive: true });
    await fs.rename(tempPath, persistentPath);
    console.info(`[UploadRoute] Moved uploaded file to: ${persistentPath}`);

    // Use Drizzle's inferred insert type
    const newSourceMetadata: Record<string, any> = {};
    if (languageCode) {
      newSourceMetadata.languageCode = languageCode;
    }
    // Store the relative path for the worker to find the file
    newSourceMetadata.storagePath = relativeStoragePath;

    const newSource: typeof sources.$inferInsert = {
      userId,
      sourceType: 'AUDIO',
      originalFilename: originalname,
      processingStatus: 'PENDING',
      processingStage: 'TRANSCRIPTION_PENDING',
      metadata: newSourceMetadata,
    };

    const insertedSources = await db.insert(sources).values(newSource).returning({ id: sources.id });

    if (!insertedSources || insertedSources.length === 0 || !insertedSources[0].id) {
      console.error('[UploadRoute] Failed to insert source record into database after insert attempt.');
      // Attempt cleanup before throwing
      try {
        await fs.unlink(persistentPath);
        console.info(`[UploadRoute] Cleaned up file after failed DB insert: ${persistentPath}`);
      } catch (cleanupError) {
        console.error(`[UploadRoute] Failed to cleanup file ${persistentPath} after failed DB insert:`, cleanupError);
      }
      throw new Error('Failed to insert source record into database.');
    }
    sourceId = insertedSources[0].id;
    console.info(`[UploadRoute] Created source record with ID: ${sourceId}`);

    await noteProcessingQueue.add('PROCESS_AUDIO_TRANSCRIPTION', { sourceId });
    console.info(`[UploadRoute] Enqueued PROCESS_AUDIO_TRANSCRIPTION job for sourceId: ${sourceId}`);

    res.status(201).json({
      sourceId: sourceId,
      message: 'Audio uploaded successfully. Transcription has started.',
    });

  } catch (error) {
    console.error('[UploadRoute] !!! Error caught within /upload handler !!!', error);
    // Ensure the error is passed to the next error handler, 
    // potentially the global one, even if it might not log verbosely.
    next(error); 
  }
}));
// --- End POST /api/media/upload ---

export const mediaRoutes = router; 