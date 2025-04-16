import { db } from '@/core/db/index';
import { folders, notes } from '@/core/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { CreateFolderInput, UpdateFolderInput } from './folders.validation';
import { AppError } from '@/core/errors/app.error';

export interface FolderWithCount extends Omit<typeof folders.$inferSelect, 'userId'> {
    noteCount: number;
    children: FolderWithCount[];
}

/**
 * Fetches all folders for a user, calculates note counts, and arranges them hierarchically.
 */
export async function getUserFolders(userId: number): Promise<FolderWithCount[]> {
    
    // 1. Fetch all folders for the user
    const allUserFolders = await db.select().from(folders).where(eq(folders.userId, userId));

    // 2. Fetch note counts for each folder
    const noteCountsResult = await db
        .select({
            folderId: notes.folderId,
            count: sql<number>`count(*)::int`,
        })
        .from(notes)
        .where(eq(notes.userId, userId))
        .groupBy(notes.folderId);

    // 3. Create a map for quick count lookup
    const noteCountMap = new Map<number | null, number>();
    noteCountsResult.forEach(row => {
        noteCountMap.set(row.folderId, row.count);
    });

    // 4. Create a map for easy folder lookup and initialize FolderWithCount structure
    const folderMap = new Map<number, FolderWithCount>();
    const rootFolders: FolderWithCount[] = [];

    allUserFolders.forEach(folder => {
        const folderData: FolderWithCount = {
            ...folder,
            noteCount: noteCountMap.get(folder.id) || 0,
            children: [],
        };
        folderMap.set(folder.id, folderData);
    });

    // 5. Build the hierarchy
    allUserFolders.forEach(folder => {
        const currentFolderData = folderMap.get(folder.id)!;
        if (folder.parentId && folderMap.has(folder.parentId)) {
            folderMap.get(folder.parentId)!.children.push(currentFolderData);
        } else {
            // If no parentId or parent not found (shouldn't happen with FK constraint), treat as root
            rootFolders.push(currentFolderData);
        }
    });

    return rootFolders;
}

/**
 * Fetches a specific folder by ID, ensuring it belongs to the user.
 */
export async function getFolderById(userId: number, folderId: number): Promise<typeof folders.$inferSelect | undefined> {
    const folder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.userId, userId))
    });
    return folder; // Returns the folder object or undefined if not found/not owned
}

/**
 * Creates a new folder for a user.
 * Validates parentId if provided.
 */
export async function createFolder(userId: number, input: CreateFolderInput): Promise<typeof folders.$inferSelect> {
    const { name, parentId } = input;

    // 1. Validate parentId if provided
    if (parentId) {
        const parentFolder = await db.query.folders.findFirst({
            where: and(eq(folders.id, parentId), eq(folders.userId, userId)),
            columns: { id: true }, // Only need to check existence
        });
        if (!parentFolder) {
            throw new AppError('404', 'Parent folder not found or does not belong to the user.');
        }
    }

    // 2. Insert the new folder
    const [newFolder] = await db
        .insert(folders)
        .values({
            userId,
            name,
            parentId: parentId || null, // Ensure null if undefined/falsy
            updatedAt: new Date(), // Set initial updatedAt
        })
        .returning(); // Return the newly created folder data
        
    if (!newFolder) {
         throw new AppError('500', 'Failed to create folder in database.');
    }

    return newFolder;
}

/**
 * Updates a folder's name and/or parent.
 * Validates target folder existence and ownership.
 * Validates new parentId if provided.
 * Prevents setting a folder as its own parent.
 */
export async function updateFolder(
    userId: number, 
    folderId: number, 
    input: UpdateFolderInput
): Promise<typeof folders.$inferSelect> {
    const { name, parentId } = input;

    // 1. Check if the target folder exists and belongs to the user
    const targetFolder = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.userId, userId))
    });

    if (!targetFolder) {
        throw new AppError('404', 'Target folder not found or does not belong to the user.');
    }

    // 2. Prevent setting folder as its own parent or child
    if (parentId !== undefined && parentId === folderId) {
        throw new AppError('400', 'Cannot make a folder a parent of itself.');
    }
    // Advanced check: Prevent moving a folder into one of its own descendants (more complex, skip for now unless requested)

    // 3. Validate new parentId if provided
    if (parentId !== undefined && parentId !== null) { // Check if parentId is being set to another folder
        const newParentFolder = await db.query.folders.findFirst({
            where: and(eq(folders.id, parentId), eq(folders.userId, userId)),
            columns: { id: true }, // Only need to check existence
        });
        if (!newParentFolder) {
            throw new AppError('404', 'New parent folder not found or does not belong to the user.');
        }
    }
    
    // 4. Prepare update values
    const updateValues: Partial<typeof folders.$inferInsert> = {};
    if (name !== undefined) {
        updateValues.name = name;
    }
    if (parentId !== undefined) { // We check undefined specifically to allow setting parentId to null
        updateValues.parentId = parentId; 
    }
    updateValues.updatedAt = new Date();

    // 5. Perform the update
    const [updatedFolder] = await db
        .update(folders)
        .set(updateValues)
        .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
        .returning();

    if (!updatedFolder) {
        // This shouldn't happen if the initial check passed, but good practice
        throw new AppError('500', 'Failed to update folder in database.');
    }

    return updatedFolder;
}

/**
 * Deletes a folder and its descendants.
 * Verifies folder existence and ownership.
 * Notes within the deleted folders will have their folderId set to null.
 */
export async function deleteFolder(userId: number, folderId: number): Promise<{ deletedId: number }> {
    // 1. Check if the folder exists and belongs to the user
    // We fetch it first to ensure ownership before deleting.
    const folderToDelete = await db.query.folders.findFirst({
        where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
        columns: { id: true },
    });

    if (!folderToDelete) {
        throw new AppError('404', 'Folder not found or does not belong to the user.');
    }

    // 2. Perform the deletion
    // Due to `onDelete: 'cascade'` on the parentId FK, deleting a parent 
    // folder will automatically delete all its descendants in the database.
    // Due to `onDelete: 'set null'` on the notes.folderId FK, notes in the
    // deleted folder (and its descendants) will have their folderId set to null.
    const result = await db
        .delete(folders)
        .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
        .returning({ deletedId: folders.id });
        
    if (result.length === 0) {
         // This might happen in a race condition, though unlikely after the initial check.
         throw new AppError('500', 'Failed to delete folder from database.');
    }

    return result[0];
} 