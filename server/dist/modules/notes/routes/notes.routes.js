"use strict";
/// <reference types="../../../types/express" />
// Note: Keep the triple-slash directive for build-time checking
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
exports.notesRoutes = void 0;
const express_1 = require("express");
// Removed direct db/schema imports
const auth_middleware_1 = require("../../../core/middleware/auth.middleware");
const zod_1 = require("zod");
// Import service functions
const notes_service_1 = require("../notes.service"); // Added updateNote, deleteNote
const router = (0, express_1.Router)();
// --- Get Notes List --- //
const GetNotesListQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
    favorite: zod_1.z.enum(['true', 'false'])
        .optional()
        .transform(val => (val === undefined ? undefined : val === 'true')),
    folderId: zod_1.z.coerce.number().int().positive().optional(),
});
// Use the explicit AuthenticatedRequest type
const getNotesListHandler = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        // This check might be redundant if ensureAuthenticated guarantees req.user
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const validation = GetNotesListQuerySchema.safeParse(req.query);
    if (!validation.success) {
        res.status(400).json({ message: 'Invalid query parameters', errors: validation.error.format() });
        return;
    }
    const { limit, offset, favorite, folderId } = validation.data;
    try {
        // Call the service function
        const result = yield (0, notes_service_1.getUserNotes)(userId, { limit, offset, favorite, folderId });
        res.status(200).json(result); // Send the { notes, total } object
    }
    catch (error) {
        console.error('Error fetching notes list:', error);
        // Pass error to a central handler eventually
        // For now, send a generic error
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to fetch notes list' });
        }
        else {
            next(error); // If headers sent, pass to default handler
        }
    }
});
// --- Get Note By ID --- //
const GetNoteParamsSchema = zod_1.z.object({
    id: zod_1.z.coerce.number().int().positive(),
});
// Use the explicit AuthenticatedRequest type
const getNoteByIdHandler = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const paramsValidation = GetNoteParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        res.status(400).json({ message: 'Invalid note ID', errors: paramsValidation.error.format() });
        return;
    }
    const { id: noteId } = paramsValidation.data;
    try {
        // Call the service function
        const note = yield (0, notes_service_1.getNoteById)(noteId, userId);
        if (!note) {
            res.status(404).json({ message: 'Note not found' });
            return;
        }
        res.status(200).json(note); // Send the detailed note object
    }
    catch (error) {
        console.error(`Error fetching note with ID ${noteId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to fetch note' });
        }
        else {
            next(error); // Pass to default handler
        }
    }
});
// --- Schemas --- //
const NoteIdParamsSchema = zod_1.z.object({
    id: zod_1.z.coerce.number().int().positive(),
});
// Schema for validating the PATCH request body
const UpdateNoteBodySchema = zod_1.z.object({
    favorite: zod_1.z.boolean().optional(),
    folderId: zod_1.z.number().int().positive().nullable().optional(),
    // Only allow favorite and folderId for now
}).strict(); // Use strict to prevent extra fields
// --- Handlers --- //
// PATCH /:id Handler
const updateNoteHandler = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('[PATCH /notes/:id] Handler called');
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const paramsValidation = NoteIdParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        res.status(400).json({ message: 'Invalid note ID', errors: paramsValidation.error.format() });
        return;
    }
    const { id: noteId } = paramsValidation.data;
    const bodyValidation = UpdateNoteBodySchema.safeParse(req.body);
    if (!bodyValidation.success) {
        res.status(400).json({ message: 'Invalid request body', errors: bodyValidation.error.format() });
        return;
    }
    const updateData = bodyValidation.data;
    // Check if there's actually anything to update
    if (Object.keys(updateData).length === 0) {
        res.status(400).json({ message: 'No update fields provided.' });
        return;
    }
    try {
        const updatedNote = yield (0, notes_service_1.updateNote)(noteId, userId, updateData);
        if (!updatedNote) {
            console.error('[PATCH /notes/:id] Update failed: note not found or not authorized', { noteId, userId, updateData });
            res.status(404).json({ message: 'Note not found or not authorized to update.' });
            return;
        }
        res.status(200).json(updatedNote);
    }
    catch (error) {
        console.error(`[PATCH /notes/:id] Error updating note`, {
            noteId,
            userId,
            updateData,
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
        });
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to update note.' });
        }
        else {
            next(error);
        }
    }
});
// DELETE /:id Handler
const deleteNoteHandler = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const paramsValidation = NoteIdParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
        res.status(400).json({ message: 'Invalid note ID', errors: paramsValidation.error.format() });
        return;
    }
    const { id: noteId } = paramsValidation.data;
    try {
        // We don't strictly need the result here, but could use it to check if deletion occurred
        yield (0, notes_service_1.deleteNote)(noteId, userId);
        res.status(204).send(); // Success - No Content
    }
    catch (error) {
        console.error(`Error deleting note ${noteId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to delete note.' });
        }
        else {
            next(error); // Pass to default handler
        }
    }
});
// --- Register Routes --- //
// Apply auth middleware to all routes in this file
router.use(auth_middleware_1.ensureAuthenticated);
// GET routes
router.get('/', (req, res, next) => getNotesListHandler(req, res, next));
router.get('/:id', (req, res, next) => getNoteByIdHandler(req, res, next));
// PATCH route
router.patch('/:id', (req, res, next) => updateNoteHandler(req, res, next));
// DELETE route
router.delete('/:id', (req, res, next) => deleteNoteHandler(req, res, next));
exports.notesRoutes = router;
