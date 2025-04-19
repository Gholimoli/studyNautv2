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
exports.getUserFolders = getUserFolders;
exports.getFolderById = getFolderById;
exports.createFolder = createFolder;
exports.updateFolder = updateFolder;
exports.deleteFolder = deleteFolder;
const index_1 = require("../../core/db/index");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const app_error_1 = require("../../core/errors/app.error");
/**
 * Fetches all folders for a user, calculates note counts, and arranges them hierarchically.
 */
function getUserFolders(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Fetch all folders for the user
        const allUserFolders = yield index_1.db.select().from(schema_1.folders).where((0, drizzle_orm_1.eq)(schema_1.folders.userId, userId));
        // 2. Fetch note counts for each folder
        const noteCountsResult = yield index_1.db
            .select({
            folderId: schema_1.notes.folderId,
            count: (0, drizzle_orm_1.sql) `count(*)::int`,
        })
            .from(schema_1.notes)
            .where((0, drizzle_orm_1.eq)(schema_1.notes.userId, userId))
            .groupBy(schema_1.notes.folderId);
        // 3. Create a map for quick count lookup
        const noteCountMap = new Map();
        noteCountsResult.forEach(row => {
            noteCountMap.set(row.folderId, row.count);
        });
        // 4. Create a map for easy folder lookup and initialize FolderWithCount structure
        const folderMap = new Map();
        const rootFolders = [];
        allUserFolders.forEach(folder => {
            const folderData = Object.assign(Object.assign({}, folder), { noteCount: noteCountMap.get(folder.id) || 0, children: [] });
            folderMap.set(folder.id, folderData);
        });
        // 5. Build the hierarchy
        allUserFolders.forEach(folder => {
            const currentFolderData = folderMap.get(folder.id);
            if (folder.parentId && folderMap.has(folder.parentId)) {
                folderMap.get(folder.parentId).children.push(currentFolderData);
            }
            else {
                // If no parentId or parent not found (shouldn't happen with FK constraint), treat as root
                rootFolders.push(currentFolderData);
            }
        });
        return rootFolders;
    });
}
/**
 * Fetches a specific folder by ID, ensuring it belongs to the user.
 */
function getFolderById(userId, folderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const folder = yield index_1.db.query.folders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.folders.id, folderId), (0, drizzle_orm_1.eq)(schema_1.folders.userId, userId))
        });
        return folder; // Returns the folder object or undefined if not found/not owned
    });
}
/**
 * Creates a new folder for a user.
 * Validates parentId if provided.
 */
function createFolder(userId, input) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, parentId } = input;
        // 1. Validate parentId if provided
        if (parentId) {
            const parentFolder = yield index_1.db.query.folders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.folders.id, parentId), (0, drizzle_orm_1.eq)(schema_1.folders.userId, userId)),
                columns: { id: true }, // Only need to check existence
            });
            if (!parentFolder) {
                throw new app_error_1.AppError('404', 'Parent folder not found or does not belong to the user.');
            }
        }
        // 2. Insert the new folder
        const [newFolder] = yield index_1.db
            .insert(schema_1.folders)
            .values({
            userId,
            name,
            parentId: parentId || null, // Ensure null if undefined/falsy
            updatedAt: new Date(), // Set initial updatedAt
        })
            .returning(); // Return the newly created folder data
        if (!newFolder) {
            throw new app_error_1.AppError('500', 'Failed to create folder in database.');
        }
        return newFolder;
    });
}
/**
 * Updates a folder's name and/or parent.
 * Validates target folder existence and ownership.
 * Validates new parentId if provided.
 * Prevents setting a folder as its own parent.
 */
function updateFolder(userId, folderId, input) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, parentId } = input;
        // 1. Check if the target folder exists and belongs to the user
        const targetFolder = yield index_1.db.query.folders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.folders.id, folderId), (0, drizzle_orm_1.eq)(schema_1.folders.userId, userId))
        });
        if (!targetFolder) {
            throw new app_error_1.AppError('404', 'Target folder not found or does not belong to the user.');
        }
        // 2. Prevent setting folder as its own parent or child
        if (parentId !== undefined && parentId === folderId) {
            throw new app_error_1.AppError('400', 'Cannot make a folder a parent of itself.');
        }
        // Advanced check: Prevent moving a folder into one of its own descendants (more complex, skip for now unless requested)
        // 3. Validate new parentId if provided
        if (parentId !== undefined && parentId !== null) { // Check if parentId is being set to another folder
            const newParentFolder = yield index_1.db.query.folders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.folders.id, parentId), (0, drizzle_orm_1.eq)(schema_1.folders.userId, userId)),
                columns: { id: true }, // Only need to check existence
            });
            if (!newParentFolder) {
                throw new app_error_1.AppError('404', 'New parent folder not found or does not belong to the user.');
            }
        }
        // 4. Prepare update values
        const updateValues = {};
        if (name !== undefined) {
            updateValues.name = name;
        }
        if (parentId !== undefined) { // We check undefined specifically to allow setting parentId to null
            updateValues.parentId = parentId;
        }
        updateValues.updatedAt = new Date();
        // 5. Perform the update
        const [updatedFolder] = yield index_1.db
            .update(schema_1.folders)
            .set(updateValues)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.folders.id, folderId), (0, drizzle_orm_1.eq)(schema_1.folders.userId, userId)))
            .returning();
        if (!updatedFolder) {
            // This shouldn't happen if the initial check passed, but good practice
            throw new app_error_1.AppError('500', 'Failed to update folder in database.');
        }
        return updatedFolder;
    });
}
/**
 * Deletes a folder and its descendants.
 * Verifies folder existence and ownership.
 * Notes within the deleted folders will have their folderId set to null.
 */
function deleteFolder(userId, folderId) {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Check if the folder exists and belongs to the user
        // We fetch it first to ensure ownership before deleting.
        const folderToDelete = yield index_1.db.query.folders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.folders.id, folderId), (0, drizzle_orm_1.eq)(schema_1.folders.userId, userId)),
            columns: { id: true },
        });
        if (!folderToDelete) {
            throw new app_error_1.AppError('404', 'Folder not found or does not belong to the user.');
        }
        // 2. Perform the deletion
        // Due to `onDelete: 'cascade'` on the parentId FK, deleting a parent 
        // folder will automatically delete all its descendants in the database.
        // Due to `onDelete: 'set null'` on the notes.folderId FK, notes in the
        // deleted folder (and its descendants) will have their folderId set to null.
        const result = yield index_1.db
            .delete(schema_1.folders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.folders.id, folderId), (0, drizzle_orm_1.eq)(schema_1.folders.userId, userId)))
            .returning({ deletedId: schema_1.folders.id });
        if (result.length === 0) {
            // This might happen in a race condition, though unlikely after the initial check.
            throw new app_error_1.AppError('500', 'Failed to delete folder from database.');
        }
        return result[0];
    });
}
