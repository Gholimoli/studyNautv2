import { db } from '@/core/db';
import { notes } from '@/core/db/schema';
import { eq, and, desc, count, SQL } from 'drizzle-orm';

// --- Types (Consider moving to a shared types file later) ---

// Type for the list response matching frontend needs
interface NoteListItem {
  id: number;
  sourceId: number;
  userId: number;
  title: string;
  createdAt: Date; // Use Date objects
  updatedAt: Date;
  favorite: boolean;
  folderId?: number | null; // Ensure this is selected
  // Add other needed fields like languageCode, sourceType if required by list view
}

interface GetNotesListResponse {
  notes: NoteListItem[];
  total: number;
}

// Type for the detailed note response matching frontend needs
interface NoteDetail extends NoteListItem { // Extend base list item
  markdownContent?: string | null;
  htmlContent?: string | null;
  languageCode?: string | null;
  // originalTranscript?: string; // Add if needed
}

// --- Service Functions --- //

/**
 * Fetches a paginated list of notes for a user, with optional filtering.
 */
export async function getUserNotes(
  userId: number, 
  options: { limit: number; offset: number; favorite?: boolean }
): Promise<GetNotesListResponse> {
  const { limit, offset, favorite } = options;

  const conditions: SQL[] = [eq(notes.userId, userId)];
  if (favorite !== undefined) {
    conditions.push(eq(notes.favorite, favorite));
  }
  const whereCondition = and(...conditions);

  // Fetch notes for the current page
  const notesList = await db
    .select({
      id: notes.id,
      sourceId: notes.sourceId,
      userId: notes.userId,
      title: notes.title,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      favorite: notes.favorite,
      folderId: notes.folderId, // Include folderId
      // languageCode: notes.languageCode, // Include if needed by list view
    })
    .from(notes)
    .where(whereCondition)
    .orderBy(desc(notes.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch total count matching the filters
  const totalResult = await db
    .select({ total: count() })
    .from(notes)
    .where(whereCondition);

  const total = totalResult[0]?.total ?? 0;

  return {
    notes: notesList, // Drizzle returns Date objects directly
    total,
  };
}

/**
 * Fetches a single note by its ID, ensuring it belongs to the specified user.
 */
export async function getNoteById(noteId: number, userId: number): Promise<NoteDetail | null> {
  const noteResult = await db
    .select({ // Select all fields needed for NoteDetail
        id: notes.id,
        sourceId: notes.sourceId,
        userId: notes.userId,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        favorite: notes.favorite,
        folderId: notes.folderId,
        markdownContent: notes.markdownContent,
        htmlContent: notes.htmlContent,
        languageCode: notes.languageCode, 
    })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .limit(1);

  if (noteResult.length === 0) {
    return null; // Return null if not found
  }

  return noteResult[0];
}

// --- Update Note Service --- 
interface UpdateNoteData {
  favorite?: boolean;
  folderId?: number | null;
  // Add other updatable fields like title, content later if needed
}

export async function updateNote(noteId: number, userId: number, data: UpdateNoteData): Promise<NoteDetail | null> {
  // Filter out undefined values to only update provided fields
  const updateData: Partial<typeof notes.$inferInsert> = {};
  if (data.favorite !== undefined) {
    updateData.favorite = data.favorite;
  }
  // Allow setting folderId to null
  if (data.folderId !== undefined) { 
    updateData.folderId = data.folderId;
  }

  // Don't proceed if no actual data to update
  if (Object.keys(updateData).length === 0) {
    // Optionally fetch and return the current note if no update is needed
    // Or throw an error indicating no update fields provided
    console.warn('UpdateNote called with no fields to update.');
    return getNoteById(noteId, userId); // Return current state
  }

  // Add updatedAt timestamp
  updateData.updatedAt = new Date();

  try {
    const updatedNotes = await db
      .update(notes)
      .set(updateData)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning({ // Select the fields matching NoteDetail
        id: notes.id,
        sourceId: notes.sourceId,
        userId: notes.userId,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        favorite: notes.favorite,
        folderId: notes.folderId,
        markdownContent: notes.markdownContent,
        htmlContent: notes.htmlContent,
        languageCode: notes.languageCode, 
      });

    if (updatedNotes.length === 0) {
      return null; // Indicate note not found or not owned by user
    }
    return updatedNotes[0];

  } catch (error) {
      console.error(`Error updating note ${noteId}:`, error);
      // Re-throw or handle specific DB errors
      throw new Error('Failed to update note.');
  }
}

// --- Delete Note Service --- 
export async function deleteNote(noteId: number, userId: number): Promise<{ success: boolean }> {
  try {
    const result = await db
      .delete(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
      
    // result.rowCount might not be reliable on all drivers, 
    // but a successful execution without error implies deletion (if it existed and belonged to user)
    // Drizzle doesn't typically throw if the WHERE clause matches nothing on DELETE.
    
    // We can consider adding a check first if we need to know if it *was* deleted vs just didn't exist.
    // For now, assume success if no error.
    return { success: true }; 

  } catch (error) {
    console.error(`Error deleting note ${noteId}:`, error);
    throw new Error('Failed to delete note.');
  }
} 