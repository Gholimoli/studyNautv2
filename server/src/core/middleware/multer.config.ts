import multer, { FileFilterCallback } from 'multer';
import express from 'express'; // Import the express namespace
import path from 'path';
import fs from 'fs';

// Define the upload directory relative to the server root
const uploadDir = path.resolve(__dirname, '../../uploads');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Define callback type for destination/filename
type DestinationCallback = (error: Error | null, destination: string) => void;
type FileNameCallback = (error: Error | null, filename: string) => void;

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req: express.Request, file: express.Multer.File, cb: DestinationCallback) => {
    cb(null, uploadDir);
  },
  filename: (req: express.Request, file: express.Multer.File, cb: FileNameCallback) => {
    // Keep original filename but add timestamp prefix to avoid collisions
    const uniquePrefix = Date.now() + '-';
    cb(null, uniquePrefix + file.originalname);
  }
});

// File filter function (accept only common audio types for now)
const audioFileFilter = (req: express.Request, file: express.Multer.File, cb: FileFilterCallback) => {
  const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Use Multer's error type for better handling
    const error = new Error('Invalid file type. Only audio files are allowed.');
    // error.code = 'INVALID_FILE_TYPE'; // Optional: Add custom code if needed later
    cb(error, false);
  }
};

// Multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024 * 1024 // 1 GB limit
  }
});

export default upload; 