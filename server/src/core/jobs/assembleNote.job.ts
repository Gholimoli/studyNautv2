import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources, visuals, notes, tags, notesToTags } from '../db/schema';
import { eq, sql, ilike } from 'drizzle-orm';
import { AiStructuredContent, LessonBlock } from '../../modules/ai/types/ai.types';
import { AssembleNotePayload } from './job.definition';
import { marked } from 'marked'; // For Markdown to HTML conversion
import { aiService } from '../../modules/ai/ai.service'; // Import AiService

/**
 * Job processor for assembling the final note content.
 */
export async function assembleNoteJob(job: Job<AssembleNotePayload>): Promise<void> {
  const { sourceId } = job.data;
  console.log(`[Worker:AssembleNote] Starting job for source ID: ${sourceId}`);

  let sourceRecord: any;
  try {
    await db.update(sources)
      .set({ processingStage: 'ASSEMBLING_NOTE' })
      .where(eq(sources.id, sourceId));

    sourceRecord = await db.query.sources.findFirst({
        where: eq(sources.id, sourceId),
        with: {
            visuals: true, 
        }
    });
    if (!sourceRecord) {
      throw new Error(`Source record not found for ID: ${sourceId}`);
    }
    if (!sourceRecord.metadata || !(sourceRecord as any).metadata.aiStructure) {
      throw new Error(`Source record or AI structure not found for ID: ${sourceId}`);
    }
    if (!sourceRecord.userId) {
      throw new Error(`Source record missing userId for ID: ${sourceId}`);
    }

    const aiStructure = (sourceRecord as any).metadata.aiStructure as AiStructuredContent;
    const fetchedVisuals = (sourceRecord as any).visuals || [];
    const visualMap = new Map<string, { url: string | null, status: string }>();
    fetchedVisuals.forEach((v: any) => {
        if(v.placeholderId) {
            visualMap.set(v.placeholderId, { url: v.imageUrl, status: v.status });
        }
    });

    let markdownContent = `# ${aiStructure.title}\n\n`;
    if (aiStructure.summary) {
        markdownContent += `*${aiStructure.summary}*\n\n`;
    }

    for (const block of aiStructure.structure) {
        switch (block.type) {
            case 'heading':
                markdownContent += `${'#'.repeat(block.level || 1)} ${block.content}\n\n`;
                break;
            case 'subheading': 
                markdownContent += `## ${block.content}\n\n`;
                break;
            case 'paragraph':
                markdownContent += `${block.content}\n\n`;
                break;
            case 'bullet_list':
                block.items?.forEach(item => markdownContent += `* ${item}\n`);
                markdownContent += '\n';
                break;
            case 'key_term':
                markdownContent += `**${block.content}**\n\n`; 
                break;
            case 'visual_placeholder':
                if (block.placeholderId) {
                    const visual = visualMap.get(block.placeholderId);
                    if (visual?.status === 'COMPLETED' && visual.url) {
                        markdownContent += `![${block.content || 'Visual Content'}](${visual.url})\n*${block.content || 'Visual Content'}*\n\n`;
                    } else {
                        markdownContent += `\n<div class="p-4 border border-dashed border-muted-foreground rounded-md my-4 text-center text-muted-foreground">`;
                        markdownContent += `<p class="font-semibold">Visual Placeholder: ${block.content || block.placeholderId}</p>`;
                        markdownContent += `<p class="text-sm">${visual?.status === 'FAILED' ? '(Image generation failed)' : '(Image pending or failed)'}</p>`;
                        markdownContent += `</div>\n\n`; // Use HTML for better fallback styling
                    }
                } else {
                     markdownContent += `\n<div class="p-4 border border-dashed border-destructive rounded-md my-4 text-center text-destructive">[Visual Placeholder: Invalid ID]</div>\n\n`;
                }
                break;
        }
    }

    marked.setOptions({
        gfm: true,
        breaks: true,
    });
    const htmlContent = marked.parse(markdownContent) as string;

    // --- Generate and Save Tags --- 
    let generatedTagIds: number[] = [];
    try {
      console.log(`[Worker:AssembleNote] Generating tags for source ID: ${sourceId}...`);
      const generatedTagNames = await aiService.generateTags(markdownContent);
      console.log(`[Worker:AssembleNote] Generated ${generatedTagNames.length} tag names:`, generatedTagNames);

      if (generatedTagNames.length > 0) {
        // Find existing tags or create new ones (case-insensitive)
        const tagPromises = generatedTagNames.map(async (tagName) => {
          const normalizedTagName = tagName.trim().toLowerCase(); // Normalize for lookup
          if (!normalizedTagName) return null; // Skip empty tags

          let existingTag = await db.query.tags.findFirst({
            where: ilike(tags.name, normalizedTagName), // Case-insensitive search
          });

          if (existingTag) {
            console.log(`[Worker:AssembleNote] Found existing tag: ID=${existingTag.id}, Name=${existingTag.name}`);
            return existingTag.id;
          } else {
            const originalCasingTagName = tagName.trim(); 
            console.log(`[Worker:AssembleNote] Attempting to insert new tag: Name=${originalCasingTagName}`);
            const newTagResult = await db.insert(tags)
              .values({ name: originalCasingTagName })
              .onConflictDoNothing({ target: tags.name })
              .returning({ id: tags.id });
              
            if (newTagResult && newTagResult.length > 0 && newTagResult[0].id) {
                console.log(`[Worker:AssembleNote] Successfully inserted new tag: ID=${newTagResult[0].id}, Name=${originalCasingTagName}`);
                return newTagResult[0].id;
            } else {
                // Conflict occurred or insert failed, re-fetch *confidently* by normalized name
                console.log(`[Worker:AssembleNote] Conflict or failed insert for tag '${originalCasingTagName}'. Re-fetching ID by normalized name: '${normalizedTagName}'`);
                const conflictedTag = await db.query.tags.findFirst({
                    where: ilike(tags.name, normalizedTagName),
                });
                if(conflictedTag) {
                    console.log(`[Worker:AssembleNote] Re-fetched tag after conflict: ID=${conflictedTag.id}, Name=${conflictedTag.name}`);
                    return conflictedTag.id;
                } else {
                    // This case should be rare if the conflict target is name uniqueness
                    console.error(`[Worker:AssembleNote] CRITICAL: Could not insert or re-fetch tag: '${originalCasingTagName}'`);
                    return null;
                }
            }
          }
        });
        
        const resolvedTagIds = await Promise.all(tagPromises);
        generatedTagIds = resolvedTagIds.filter((id): id is number => id !== null); // Filter out nulls
        console.log(`[Worker:AssembleNote] Resolved tag IDs:`, generatedTagIds);
        console.log(`[Worker:AssembleNote] Tag IDs to be linked:`, generatedTagIds);
      }
    } catch (tagError) {
      // Log tag generation/saving error but don't fail the whole job
      console.error(`[Worker:AssembleNote] Error generating or saving tags for source ID ${sourceId}:`, tagError);
    }
    // ------------------------

    // Use transaction for note creation and tag linking
    await db.transaction(async (tx) => {
        // Fallback: infer sourceType if missing
        let finalSourceType = sourceRecord!.sourceType;
        if (!finalSourceType && sourceRecord!.originalFilename) {
            const ext = sourceRecord!.originalFilename.split('.').pop()?.toLowerCase();
            if (ext === 'pdf') finalSourceType = 'PDF';
            else if (ext === 'mp3' || ext === 'wav' || ext === 'm4a') finalSourceType = 'AUDIO';
            else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') finalSourceType = 'IMAGE';
            else finalSourceType = 'TEXT';
        }
        // Fallback: infer languageCode from metadata or default to 'en'
        let finalLanguageCode = (sourceRecord!.metadata?.languageCode as string | undefined) || (sourceRecord as any).languageCode || 'en';

        // Insert the note
        const insertedNotes = await tx.insert(notes).values({
            sourceId: sourceId,
            userId: sourceRecord!.userId, // Non-null after check
            title: aiStructure.title,
            summary: aiStructure.summary,
            markdownContent: markdownContent,
            htmlContent: htmlContent,
            favorite: false,
            sourceType: finalSourceType,
            languageCode: finalLanguageCode,
        }).returning({ noteId: notes.id });

        const newNoteId = insertedNotes[0]?.noteId;
        if (!newNoteId) {
            throw new Error("Failed to insert note or retrieve ID.");
        }
        console.log(`[Worker:AssembleNote] Note record created with ID: ${newNoteId}`);

        // Link tags to the new note
        if (generatedTagIds.length > 0) {
            console.log(`[Worker:AssembleNote] DEBUG: Linking tags with IDs: ${generatedTagIds.join(', ')} to note ID: ${newNoteId}`);
            const notesTagsValues = generatedTagIds.map(tagId => ({
                noteId: newNoteId,
                tagId: tagId,
            }));
            await tx.insert(notesToTags).values(notesTagsValues);
            console.log(`[Worker:AssembleNote] Linked ${generatedTagIds.length} tags to note ID: ${newNoteId}`);
        } else {
             console.log(`[Worker:AssembleNote] DEBUG: No generated tag IDs to link for note ID: ${newNoteId}`);
        }

        // Update source status within the transaction
        await tx.update(sources)
          .set({ processingStatus: 'COMPLETED', processingStage: 'COMPLETED' })
          .where(eq(sources.id, sourceId));
    });

    console.log(`[Worker:AssembleNote] Successfully finished job for source ID: ${sourceId}. Note created/tags linked. Source marked COMPLETED.`);

  } catch (error) {
    console.error(`[Worker:AssembleNote] Error processing job for source ID: ${sourceId}`, error);
    await db.update(sources)
      .set({ 
          processingStatus: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Error assembling note content',
          processingStage: 'ASSEMBLING_NOTE' 
       })
      .where(eq(sources.id, sourceId));
    throw error;
  }
} 