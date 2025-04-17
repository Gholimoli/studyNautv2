import { db } from '@/core/db';
import { notes, tags, notesToTags } from '@/core/db/schema';
import { eq, and, desc, count, SQL, sql } from 'drizzle-orm';

// --- Types (Consider moving to a shared types file later) ---

interface Tag {
  id: number;
  name: string;
}

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
  sourceType: 'YOUTUBE' | 'TEXT' | 'AUDIO' | 'PDF' | 'IMAGE' | null; // Allow null based on schema
  tags?: Tag[]; // Added optional tags array
  languageCode?: string | null;
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
 * Fetches a paginated list of notes for a user, with optional filtering and tags.
 */
export async function getUserNotes(
  userId: number, 
  options: { limit: number; offset: number; favorite?: boolean; folderId?: number }
): Promise<GetNotesListResponse> {
  const { limit, offset, favorite, folderId } = options;

  console.log("[getUserNotes] Received options for filtering:", options);

  const conditions: SQL[] = [eq(notes.userId, userId)];
  if (favorite !== undefined) {
    conditions.push(eq(notes.favorite, favorite));
  }
  if (folderId !== undefined) {
    console.log(`[getUserNotes] Applying filter for folderId: ${folderId}`);
    conditions.push(eq(notes.folderId, folderId));
  } else {
    // Potentially handle case where NO folderId is passed (e.g., show unfiled?)
    // For now, if folderId is undefined, we don't add a folder filter, showing all.
    // If you want to filter for NULL folderId when none is provided, add:
    // console.log("[getUserNotes] Applying filter for NULL folderId");
    // conditions.push(sql`${notes.folderId} is null`);
  }
  const whereCondition = and(...conditions);

  // <<< ADD LOG HERE >>>
  console.log("[getUserNotes] Executing DB query with WHERE condition:", whereCondition);

  // Alias for subquery or grouping if needed, though direct aggregation might work
  // const nt = alias(notesToTags, 'nt');
  // const t = alias(tags, 't');

  // Fetch notes with aggregated tags
  const notesList = await db
    .select({
      id: notes.id,
      sourceId: notes.sourceId,
      userId: notes.userId,
      title: notes.title,
      summary: notes.summary,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      favorite: notes.favorite,
      folderId: notes.folderId,
      sourceType: notes.sourceType,
      languageCode: notes.languageCode,
      tags: sql<string>`
        COALESCE(
          jsonb_agg(
            jsonb_build_object('id', ${tags.id}, 'name', ${tags.name})
            ORDER BY ${tags.name} ASC
          ) FILTER (WHERE ${notesToTags.tagId} IS NOT NULL), 
          '[]'::jsonb
        )
      `.as('tags')
    })
    .from(notes)
    .leftJoin(notesToTags, eq(notes.id, notesToTags.noteId))
    .leftJoin(tags, eq(notesToTags.tagId, tags.id))
    .where(whereCondition)
    .groupBy(notes.id)
    .orderBy(desc(notes.createdAt))
    .limit(limit)
    .offset(offset);

  // <<< ADD LOG HERE >>>
  console.log("[getUserNotes] Raw notesList from DB:", JSON.stringify(notesList, null, 2)); 

  // Fetch total count matching the filters
  const totalResult = await db
    .select({ total: count() })
    .from(notes)
    .where(whereCondition);

  const total = totalResult[0]?.total ?? 0;

  // Parse the tags JSON string back into an object array
  const notesWithParsedTags: NoteListItem[] = notesList.map(note => ({
    ...note,
    // Tags are already parsed by the DB query (jsonb_agg)
    // Ensure the type matches NoteListItem which includes languageCode
    tags: Array.isArray(note.tags) ? note.tags : [], 
    languageCode: note.languageCode, // Ensure languageCode is included
    // Ensure sourceType is handled (it can be null from the DB)
    sourceType: note.sourceType ?? null // Default to null if DB returns null
  }));

  return {
    notes: notesWithParsedTags,
    total,
  };
}

/**
 * Fetches a single note by its ID, ensuring it belongs to the specified user.
 */
export async function getNoteById(noteId: number, userId: number): Promise<NoteDetail | null> {
  // Revert to simpler select, add sourceType
  const noteResult = await db
    .select({
      id: notes.id,
      sourceId: notes.sourceId,
      userId: notes.userId,
      title: notes.title,
      summary: notes.summary,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      favorite: notes.favorite,
      folderId: notes.folderId,
      markdownContent: notes.markdownContent,
      htmlContent: notes.htmlContent,
      languageCode: notes.languageCode,
      sourceType: notes.sourceType, // Added sourceType
    })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .limit(1);

  if (noteResult.length === 0) {
    return null;
  }

  // Map to NoteDetail, handle null sourceType
  const noteDetail: NoteDetail = {
    ...noteResult[0],
    sourceType: noteResult[0].sourceType ?? null,
    // No tags mapping needed here for now
  };
  return noteDetail;
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
  if (data.folderId !== undefined) { 
    updateData.folderId = data.folderId;
  }

  if (Object.keys(updateData).length === 0) {
    // Explicitly return the result of getNoteById if no update occurs
    return await getNoteById(noteId, userId); 
  }
  updateData.updatedAt = new Date();

  try {
    const updatedNotes = await db
      .update(notes)
      .set(updateData)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning({ 
        id: notes.id,
        sourceId: notes.sourceId,
        userId: notes.userId,
        title: notes.title,
        summary: notes.summary,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        favorite: notes.favorite,
        folderId: notes.folderId,
        markdownContent: notes.markdownContent,
        htmlContent: notes.htmlContent,
        languageCode: notes.languageCode, 
        sourceType: notes.sourceType,
      });

    if (updatedNotes.length === 0) {
      return null; 
    }
    
    const result = updatedNotes[0];
    // Fix mapping: Spread result and only override/add specific fields needed
    const updatedNoteDetail: NoteDetail = {
        ...result, // Spread all returned fields
        sourceType: result.sourceType ?? null, // Ensure null handling
        // Explicitly set tags as undefined since update doesn't return them
        tags: undefined, 
    };
    return updatedNoteDetail; 

  } catch (error) {
    console.error(`Error updating note ${noteId}:`, error);
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