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
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const notes_service_1 = require("../../../modules/notes/notes.service");
// If you need RequestWithUser, define it here or use Request & { user: ... } inline
// import type { RequestWithUser } from '../../middleware/auth.middleware';
const router = (0, express_1.Router)();
/**
 * GET /api/notes
 * Retrieves a list of notes for the authenticated user.
 */
router.get('/', auth_middleware_1.ensureAuthenticated, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // req.user should be populated by the 'ensureAuthenticated' middleware
    const user = req.user;
    if (!user || !user.id) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const userId = user.id;
    // Parse query params for limit/offset/favorite/folderId as needed
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const favorite = req.query.favorite !== undefined ? req.query.favorite === 'true' : undefined;
    // --- Refined folderId Parsing ---
    const folderIdParam = req.query.folderId;
    let folderId = undefined; // Initialize as undefined
    if (folderIdParam !== undefined && typeof folderIdParam === 'string') {
        const parsedId = parseInt(folderIdParam, 10);
        if (!isNaN(parsedId)) {
            folderId = parsedId; // Assign only if it's a valid number
        }
        // Note: We are not handling folderId=null via query param here.
        // Filtering for null folderId usually happens when NO folderId is provided.
    }
    // -----------------------------
    try {
        // Pass the potentially undefined folderId
        const result = yield (0, notes_service_1.getUserNotes)(userId, { limit, offset, favorite, folderId });
        res.status(200).json(result);
    }
    catch (error) {
        console.error('Error fetching notes:', error);
        // Log the specific error for debugging
        // Use a generic error message for the client
        res.status(500).json({ message: 'Failed to retrieve notes due to a server error.' });
    }
    // No explicit return needed here; Express handles ending the response.
}));
exports.default = router; // Export the router instance
