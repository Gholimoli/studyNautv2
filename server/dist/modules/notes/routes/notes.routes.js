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
const db_1 = require("@server/core/db");
const schema_1 = require("@server/core/db/schema");
const auth_middleware_1 = require("@server/core/middleware/auth.middleware");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// --- Get Notes List --- //
const GetNotesListQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
    favorite: zod_1.z.enum(['true', 'false']).optional().transform(val => val === 'true'), // Assumes schema has favorite
});
// Use the explicit AuthenticatedRequest type
const getNotesListHandler = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const validation = GetNotesListQuerySchema.safeParse(req.query);
    if (!validation.success) {
        res.status(400).json({ message: 'Invalid query parameters', errors: validation.error.format() });
        return;
    }
    const { limit, offset, favorite } = validation.data;
    try {
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.notes.userId, userId)];
        if (favorite !== undefined) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.notes.favorite, favorite)); // Requires notes.favorite in schema
        }
        const whereCondition = (0, drizzle_orm_1.and)(...conditions);
        const notesList = yield db_1.db
            .select({
            id: schema_1.notes.id,
            sourceId: schema_1.notes.sourceId,
            userId: schema_1.notes.userId,
            title: schema_1.notes.title,
            createdAt: schema_1.notes.createdAt,
            updatedAt: schema_1.notes.updatedAt,
            favorite: schema_1.notes.favorite,
        })
            .from(schema_1.notes)
            .where(whereCondition)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.notes.createdAt))
            .limit(limit)
            .offset(offset);
        const totalResult = yield db_1.db
            .select({ total: (0, drizzle_orm_1.count)() })
            .from(schema_1.notes)
            .where(whereCondition);
        const total = (_c = (_b = totalResult[0]) === null || _b === void 0 ? void 0 : _b.total) !== null && _c !== void 0 ? _c : 0;
        res.status(200).json({
            notes: notesList,
            total,
        });
    }
    catch (error) {
        console.error('Error fetching notes list:', error);
        res.status(500).json({ message: 'Failed to fetch notes list' });
        // next(error); // Pass to a global error handler eventually
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
        const noteResult = yield db_1.db
            .select()
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notes.id, noteId), (0, drizzle_orm_1.eq)(schema_1.notes.userId, userId)))
            .limit(1);
        if (noteResult.length === 0) {
            res.status(404).json({ message: 'Note not found' });
            return;
        }
        res.status(200).json(noteResult[0]);
    }
    catch (error) {
        console.error(`Error fetching note with ID ${noteId}:`, error);
        res.status(500).json({ message: 'Failed to fetch note' });
        // next(error); // Pass to a global error handler eventually
    }
});
// --- Register Routes --- //
router.use(auth_middleware_1.ensureAuthenticated);
// Use wrapper functions for route handlers
router.get('/', (req, res, next) => getNotesListHandler(req, res, next));
router.get('/:id', (req, res, next) => getNoteByIdHandler(req, res, next));
exports.notesRoutes = router;
