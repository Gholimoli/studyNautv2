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
const index_1 = require("../../db/index");
const schema_1 = require("../../db/schema");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const drizzle_orm_1 = require("drizzle-orm");
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
    try {
        const userNotes = yield index_1.db
            .select({
            id: schema_1.notes.id,
            title: schema_1.notes.title,
            // TODO: Add contentPreview when schema supports it
            createdAt: schema_1.notes.createdAt,
            updatedAt: schema_1.notes.updatedAt,
            // Add other relevant fields like isArchived, tags, etc.
        })
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.eq)(schema_1.notes.userId, userId))
            .orderBy(schema_1.notes.updatedAt); // Consider making sort order configurable?
        // Send the response
        res.status(200).json(userNotes);
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
