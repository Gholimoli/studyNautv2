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
const db_1 = require("../../db"); // Relative path
const schema_1 = require("../../db/schema"); // Relative path
const auth_middleware_1 = require("../../middleware/auth.middleware"); // Corrected relative path
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
/**
 * GET /api/notes
 * Original implementation - kept separate for now
 */
// Note: This implementation might be moved/refactored into modules/notes/routes/notes.routes.ts
// Using relative paths here to avoid compile-time alias issues seen with tsc -w
router.get('/', auth_middleware_1.ensureAuthenticated, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Accessing req.user will still cause TS errors here if augmentation isn't working
    // But the code should *compile* without alias errors
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id; // Temporary workaround
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated properly.' });
        return;
    }
    try {
        const userNotes = yield db_1.db
            .select({
            id: schema_1.notes.id,
            title: schema_1.notes.title,
            // TODO: Add contentPreview when schema supports it
            createdAt: schema_1.notes.createdAt,
            updatedAt: schema_1.notes.updatedAt,
            sourceType: schema_1.notes.sourceType,
            favorite: schema_1.notes.favorite,
            // Add other relevant fields like isArchived, tags, etc.
        })
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.eq)(schema_1.notes.userId, userId))
            .orderBy(schema_1.notes.createdAt); // Changed order by to createdAt as per schema file example
        res.status(200).json(userNotes);
    }
    catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ message: 'Failed to retrieve notes due to a server error.' });
    }
}));
exports.default = router; // Export the router instance
