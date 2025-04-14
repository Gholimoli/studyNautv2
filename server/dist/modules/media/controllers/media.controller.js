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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaController = exports.MediaController = void 0;
const media_service_1 = require("../services/media.service");
const media_schemas_1 = require("../types/media.schemas");
class MediaController {
    constructor() {
        // Define as an arrow function to automatically bind 'this' and potentially help TS inference
        this.processText = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Ensure user is authenticated (req.user should be populated by Passport)
                if (!req.user || !req.user.id) {
                    // Use return to prevent further execution, though ensureAuthenticated should handle this
                    res.status(401).json({ message: 'User not authenticated' });
                    return;
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
                    // Zod errors might be caught here, consider specific handling
                    res.status(400).json({ message: error.message });
                }
                else {
                    res.status(500).json({ message: 'Internal Server Error' });
                }
                // Optionally call next(error) to pass to a global error handler
                // next(error); 
            }
        });
        // Add controllers for YouTube, upload later
    }
}
exports.MediaController = MediaController;
exports.mediaController = new MediaController();
