"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Define the upload directory relative to the server root
const uploadDir = path_1.default.resolve(__dirname, '../../uploads');
// Ensure the upload directory exists
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Configure disk storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Keep original filename but add timestamp prefix to avoid collisions
        const uniquePrefix = Date.now() + '-';
        cb(null, uniquePrefix + file.originalname);
    }
});
// File filter function (accept only common audio types for now)
const audioFileFilter = (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        // Use Multer's error type for better handling
        const error = new Error('Invalid file type. Only audio files are allowed.');
        // error.code = 'INVALID_FILE_TYPE'; // Optional: Add custom code if needed later
        cb(error, false);
    }
};
// Multer upload instance
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: audioFileFilter,
    limits: {
        fileSize: 1 * 1024 * 1024 * 1024 // 1 GB limit
    }
});
exports.default = upload;
