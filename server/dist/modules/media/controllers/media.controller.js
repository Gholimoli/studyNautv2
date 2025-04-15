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
exports.mediaController = exports.MediaController = void 0;
const media_service_1 = require("../services/media.service");
const media_schemas_1 = require("../types/media.schemas");
const fs_1 = __importDefault(require("fs"));
class MediaController {
    processText(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure user is authenticated (req.user should be populated by Passport)
                if (!req.user || !req.user.id) {
                    return res.status(401).json({ message: 'User not authenticated' });
                }
                const authenticatedUser = req.user;
                // Validate request body
                const validatedData = media_schemas_1.processTextSchema.parse(req.body);
                // Call service
                const result = yield media_service_1.mediaService.createSourceFromText(validatedData, authenticatedUser);
                // Send response (Created)
                res.status(201).json(result);
            }
            catch (error) {
                // Basic error handling 
                console.error('[MediaController ProcessText Error]:', error);
                if (error instanceof Error) {
                    res.status(400).json({ message: error.message });
                }
                else {
                    res.status(500).json({ message: 'Internal Server Error' });
                }
                // next(error); 
            }
        });
    }
    /**
     * Handles audio file upload requests.
     */
    uploadAudio(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // 1. Check authentication
                if (!req.user || !req.user.id) {
                    return res.status(401).json({ message: 'User not authenticated' });
                }
                const authenticatedUser = req.user;
                // 2. Check if file was uploaded (Multer adds file/files to req)
                if (!req.file) {
                    return res.status(400).json({ message: 'No audio file uploaded.' });
                }
                // 3. Extract optional language code (example: from query param)
                const languageCode = req.query.languageCode;
                // 4. Call the service method
                // req.file contains path, originalname, mimetype from Multer
                const result = yield media_service_1.mediaService.createSourceFromAudioUpload(req.file, authenticatedUser, languageCode);
                // 5. Send response (Created)
                res.status(201).json(result);
            }
            catch (error) {
                console.error('[MediaController UploadAudio Error]:', error);
                // Ensure local temp file (if it still exists from multer) is cleaned up on error
                if ((_a = req.file) === null || _a === void 0 ? void 0 : _a.path) {
                    try {
                        yield fs_1.default.promises.unlink(req.file.path);
                        console.log(`[MediaController] Cleaned up multer temp file on error: ${req.file.path}`);
                    }
                    catch (cleanupError) {
                        if (cleanupError.code !== 'ENOENT') { // Ignore if already deleted
                            console.error(`[MediaController] Error cleaning up multer temp file on error:`, cleanupError);
                        }
                    }
                }
                if (error instanceof Error) {
                    // Customize error response based on error type if needed
                    res.status(400).json({ message: error.message || 'Failed to process audio upload.' });
                }
                else {
                    res.status(500).json({ message: 'Internal Server Error during audio upload.' });
                }
                // next(error); // Or use global error handler
            }
        });
    }
}
exports.MediaController = MediaController;
exports.mediaController = new MediaController();
