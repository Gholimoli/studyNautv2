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
exports.getUserNotes = getUserNotes;
exports.getNoteById = getNoteById;
exports.updateNote = updateNote;
exports.deleteNote = deleteNote;
const db_1 = require("../../core/db");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
// --- Service Functions --- //
/**
 * Fetches a paginated list of notes for a user, with optional filtering and tags.
 */
function getUserNotes(userId, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { limit, offset, favorite, folderId } = options;
        console.log("[getUserNotes] Received options for filtering:", options);
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.notes.userId, userId)];
        if (favorite !== undefined) {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.notes.favorite, favorite));
        }
        if (folderId !== undefined) {
            console.log(`[getUserNotes] Applying filter for folderId: ${folderId}`);
            conditions.push((0, drizzle_orm_1.eq)(schema_1.notes.folderId, folderId));
        }
        else {
            console.log("[getUserNotes] No folderId provided, applying filter for NULL folderId.");
            conditions.push((0, drizzle_orm_1.sql) `${schema_1.notes.folderId} is null`);
        }
        const whereCondition = (0, drizzle_orm_1.and)(...conditions);
        // <<< ADD LOG HERE >>>
        console.log("[getUserNotes] Executing DB query with WHERE condition:", whereCondition);
        // Alias for subquery or grouping if needed, though direct aggregation might work
        // const nt = alias(notesToTags, 'nt');
        // const t = alias(tags, 't');
        // Fetch notes with aggregated tags
        const notesList = yield db_1.db
            .select({
            id: schema_1.notes.id,
            sourceId: schema_1.notes.sourceId,
            userId: schema_1.notes.userId,
            title: schema_1.notes.title,
            summary: schema_1.notes.summary,
            createdAt: schema_1.notes.createdAt,
            updatedAt: schema_1.notes.updatedAt,
            favorite: schema_1.notes.favorite,
            folderId: schema_1.notes.folderId,
            sourceType: schema_1.notes.sourceType,
            languageCode: schema_1.notes.languageCode,
            tags: (0, drizzle_orm_1.sql) `
        COALESCE(
          jsonb_agg(
            jsonb_build_object('id', ${schema_1.tags.id}, 'name', ${schema_1.tags.name})
            ORDER BY ${schema_1.tags.name} ASC
          ) FILTER (WHERE ${schema_1.notesToTags.tagId} IS NOT NULL), 
          '[]'::jsonb
        )
      `.as('tags')
        })
            .from(schema_1.notes)
            .leftJoin(schema_1.notesToTags, (0, drizzle_orm_1.eq)(schema_1.notes.id, schema_1.notesToTags.noteId))
            .leftJoin(schema_1.tags, (0, drizzle_orm_1.eq)(schema_1.notesToTags.tagId, schema_1.tags.id))
            .where(whereCondition)
            .groupBy(schema_1.notes.id)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.notes.createdAt))
            .limit(limit)
            .offset(offset);
        // <<< ADD LOG HERE >>>
        console.log("[getUserNotes] Raw notesList from DB:", JSON.stringify(notesList, null, 2));
        // Fetch total count matching the filters
        const totalResult = yield db_1.db
            .select({ total: (0, drizzle_orm_1.count)() })
            .from(schema_1.notes)
            .where(whereCondition);
        const total = (_b = (_a = totalResult[0]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0;
        // Parse the tags JSON string back into an object array
        const notesWithParsedTags = notesList.map(note => {
            var _a;
            return (Object.assign(Object.assign({}, note), { 
                // Tags are already parsed by the DB query (jsonb_agg)
                // Ensure the type matches NoteListItem which includes languageCode
                tags: Array.isArray(note.tags) ? note.tags : [], languageCode: note.languageCode, 
                // Ensure sourceType is handled (it can be null from the DB)
                sourceType: (_a = note.sourceType) !== null && _a !== void 0 ? _a : null // Default to null if DB returns null
             }));
        });
        return {
            notes: notesWithParsedTags,
            total,
        };
    });
}
/**
 * Fetches a single note by its ID, ensuring it belongs to the specified user.
 */
function getNoteById(noteId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Revert to simpler select, add sourceType
        const noteResult = yield db_1.db
            .select({
            id: schema_1.notes.id,
            sourceId: schema_1.notes.sourceId,
            userId: schema_1.notes.userId,
            title: schema_1.notes.title,
            summary: schema_1.notes.summary,
            createdAt: schema_1.notes.createdAt,
            updatedAt: schema_1.notes.updatedAt,
            favorite: schema_1.notes.favorite,
            folderId: schema_1.notes.folderId,
            markdownContent: schema_1.notes.markdownContent,
            htmlContent: schema_1.notes.htmlContent,
            languageCode: schema_1.notes.languageCode,
            sourceType: schema_1.notes.sourceType, // Added sourceType
        })
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notes.id, noteId), (0, drizzle_orm_1.eq)(schema_1.notes.userId, userId)))
            .limit(1);
        if (noteResult.length === 0) {
            return null;
        }
        // Map to NoteDetail, handle null sourceType
        const noteDetail = Object.assign(Object.assign({}, noteResult[0]), { sourceType: (_a = noteResult[0].sourceType) !== null && _a !== void 0 ? _a : null });
        return noteDetail;
    });
}
function updateNote(noteId, userId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // Filter out undefined values to only update provided fields
        const updateData = {};
        if (data.favorite !== undefined) {
            updateData.favorite = data.favorite;
        }
        if (data.folderId !== undefined) {
            updateData.folderId = data.folderId;
        }
        if (Object.keys(updateData).length === 0) {
            // Explicitly return the result of getNoteById if no update occurs
            return yield getNoteById(noteId, userId);
        }
        updateData.updatedAt = new Date();
        try {
            const updatedNotes = yield db_1.db
                .update(schema_1.notes)
                .set(updateData)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notes.id, noteId), (0, drizzle_orm_1.eq)(schema_1.notes.userId, userId)))
                .returning({
                id: schema_1.notes.id,
                sourceId: schema_1.notes.sourceId,
                userId: schema_1.notes.userId,
                title: schema_1.notes.title,
                summary: schema_1.notes.summary,
                createdAt: schema_1.notes.createdAt,
                updatedAt: schema_1.notes.updatedAt,
                favorite: schema_1.notes.favorite,
                folderId: schema_1.notes.folderId,
                markdownContent: schema_1.notes.markdownContent,
                htmlContent: schema_1.notes.htmlContent,
                languageCode: schema_1.notes.languageCode,
                sourceType: schema_1.notes.sourceType,
            });
            if (updatedNotes.length === 0) {
                return null;
            }
            const result = updatedNotes[0];
            // Fix mapping: Spread result and only override/add specific fields needed
            const updatedNoteDetail = Object.assign(Object.assign({}, result), { sourceType: (_a = result.sourceType) !== null && _a !== void 0 ? _a : null, 
                // Explicitly set tags as undefined since update doesn't return them
                tags: undefined });
            return updatedNoteDetail;
        }
        catch (error) {
            console.error(`Error updating note ${noteId}:`, error);
            throw new Error('Failed to update note.');
        }
    });
}
// --- Delete Note Service --- 
function deleteNote(noteId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield db_1.db
                .delete(schema_1.notes)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notes.id, noteId), (0, drizzle_orm_1.eq)(schema_1.notes.userId, userId)));
            // result.rowCount might not be reliable on all drivers, 
            // but a successful execution without error implies deletion (if it existed and belonged to user)
            // Drizzle doesn't typically throw if the WHERE clause matches nothing on DELETE.
            // We can consider adding a check first if we need to know if it *was* deleted vs just didn't exist.
            // For now, assume success if no error.
            return { success: true };
        }
        catch (error) {
            console.error(`Error deleting note ${noteId}:`, error);
            throw new Error('Failed to delete note.');
        }
    });
}
