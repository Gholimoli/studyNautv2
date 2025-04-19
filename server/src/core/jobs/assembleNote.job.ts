import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources, visuals, notes, tags, notesToTags } from '../db/schema';
import { eq, sql, ilike } from 'drizzle-orm';
import { AiStructuredContent, LessonBlock } from '../../modules/ai/types/ai.types';
import { AssembleNotePayload } from './job.definition';
import { aiService } from '../../modules/ai/ai.service'; // Import AiService

// --- Add Handlebars and FS imports ---
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
// -------------------------------------

// --- Helper function for reading files with retry ---
async function readFileWithRetry(filePath: string, retries = 2, delay = 300): Promise<string> {
  let attempts = 0;
  while (attempts <= retries) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error: any) {
      if (error.code === 'ENOENT' && attempts < retries) {
        attempts++;
        console.warn(`[Worker:AssembleNote] Template read failed (${error.code}), attempt ${attempts}/${retries}. Retrying in ${delay}ms... Path: ${filePath}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[Worker:AssembleNote] Final attempt failed to read template file: ${filePath}`, error);
        throw error; // Re-throw the error if it's not ENOENT or retries exhausted
      }
    }
  }
  // Should not be reached if retries exhausted, as error is thrown above
  throw new Error(`Failed to read file ${filePath} after ${retries} retries.`);
}
// --------------------------------------------------

// --- Template Compilation (Load once, reuse) ---
let compiledTemplates: {
  main?: HandlebarsTemplateDelegate<any>;
} = {};
let templatesLoaded = false;

async function loadAndCompileTemplates() {
  if (templatesLoaded) return;
  try {
    console.log('[Worker:AssembleNote] Loading and compiling Handlebars templates...');
    
    const cwd = process.cwd();
    const dirname = __dirname;
    console.log(`[Worker:AssembleNote] Current working directory (cwd): ${cwd}`); 
    console.log(`[Worker:AssembleNote] Directory of current file (__dirname): ${dirname}`); 

    // Revert to resolving path relative to the *compiled* file in dist/
    const templateDir = path.resolve(__dirname, '../../templates'); 
    console.log(`[Worker:AssembleNote] Attempting to load templates from resolved path (relative to dist): ${templateDir}`);

    // Log directory contents before trying to read files
    try {
        const dirContents = await fs.readdir(templateDir);
        console.log(`[Worker:AssembleNote] Contents of ${templateDir}:`, dirContents);
    } catch (readDirError) {
        console.error(`[Worker:AssembleNote] FAILED to read directory ${templateDir}:`, readDirError);
        throw new Error(`Failed to read template directory: ${readDirError}`);
    }

    // Read files using the retry helper
    const mainTemplateSource = await readFileWithRetry(path.join(templateDir, 'main-note.hbs'));
    const sectionPartialSource = await readFileWithRetry(path.join(templateDir, 'section.hbs'));
    const visualPartialSource = await readFileWithRetry(path.join(templateDir, 'visual.hbs'));
    const placeholderPartialSource = await readFileWithRetry(path.join(templateDir, 'placeholder.hbs'));

    // Register Partials
    Handlebars.registerPartial('section', sectionPartialSource);
    Handlebars.registerPartial('visual', visualPartialSource);
    Handlebars.registerPartial('placeholder', placeholderPartialSource);

    // Register Helpers
    Handlebars.registerHelper('eq', function (this: any, a: unknown, b: unknown, options?: Handlebars.HelperOptions) {
      // Robust check for block vs inline
      if (options && typeof options.fn === 'function') {
        // Block form
        return a == b ? options.fn(this) : options.inverse?.(this) ?? '';
      } else {
        // Inline form - return boolean
        return a == b;
      }
    });

    // Helper to find the visual object by placeholderId
    Handlebars.registerHelper('findVisual', function (this: any, placeholderId: string, visualsMap: Record<string, any>, options?: Handlebars.HelperOptions) {
        const visual = visualsMap && placeholderId ? visualsMap[placeholderId] : null;
        // Robust check for block vs inline
        if (options && typeof options.fn === 'function') {
            // Block form
            return visual ? options.fn(visual) : options.inverse?.(this) ?? '';
        } else {
            // Inline form - return the visual object itself or null (adjust if boolean needed)
            return visual;
        }
    });
    // Add more helpers as needed

    // Compile Main Template
    compiledTemplates.main = Handlebars.compile(mainTemplateSource);

    templatesLoaded = true;
    console.log('[Worker:AssembleNote] Handlebars templates loaded and compiled successfully.');
  } catch (error) {
    console.error('[Worker:AssembleNote] CRITICAL: Failed to load or compile Handlebars templates:', error);
    // Prevent job execution if templates fail to load
    templatesLoaded = false; 
  }
}
// -----------------------------------------------

/**
 * Job processor for assembling the final note content.
 */
export async function assembleNoteJob(job: Job<AssembleNotePayload>): Promise<void> {
  const { sourceId } = job.data;
  console.log(`[Worker:AssembleNote] Starting job for source ID: ${sourceId}`);

  // --- REMOVE DIAGNOSTIC CHECKS --- 
  /*
  try {
    const templateDir = path.resolve(__dirname, '../../templates');
    const mainTemplatePath = path.join(templateDir, 'main-note.hbs');
    console.log(`[Worker:AssembleNote] DIAGNOSTIC: Checking access for path: ${mainTemplatePath}`);
    await fs.access(mainTemplatePath, fs.constants.R_OK); // Check read access
    console.log(`[Worker:AssembleNote] DIAGNOSTIC: fs.access check PASSED for ${mainTemplatePath}`);
    const dirContents = await fs.readdir(templateDir);
    console.log(`[Worker:AssembleNote] DIAGNOSTIC: Contents of ${templateDir}:`, dirContents);
  } catch (diagError) {
      console.error(`[Worker:AssembleNote] DIAGNOSTIC: fs.access or fs.readdir FAILED:`, diagError);
      // Optional: re-throw or handle differently if needed, but let the original logic proceed for now
      // throw new Error("Diagnostic file access check failed"); 
  }
  */
  // --- END REMOVED DIAGNOSTIC CHECKS ---

  // Ensure templates are loaded before proceeding
  if (!templatesLoaded) {
    await loadAndCompileTemplates();
  }
  if (!templatesLoaded || !compiledTemplates.main) {
    throw new Error('Handlebars templates could not be loaded or compiled.');
  }

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
    const visualsMap = new Map<string, typeof fetchedVisuals[0]>(); 
    fetchedVisuals.forEach((v: any) => {
        if(v.placeholderId) {
            visualsMap.set(v.placeholderId, v);
        }
    });

    // Prepare data for the main template
    const templateData = {
        title: aiStructure.title,
        summary: aiStructure.summary,
        structure: aiStructure.structure, // Pass the whole structure array
        visuals: Object.fromEntries(visualsMap) // Convert map to object for Handlebars context
    };

    // Render HTML using Handlebars
    const htmlContent = compiledTemplates.main!(templateData); 

    // --- Generate and Save Tags --- 
    let generatedTagIds: number[] = [];
    try {
      // Generate tags from the original extracted text, not generated markdown
      const sourceTextForTags = sourceRecord.extractedText || ''; 
      const finalLanguageCode = sourceRecord.languageCode || 'eng'; 
      console.log(`[Worker:AssembleNote] Using languageCode (ISO 639-3): ${finalLanguageCode} from source column for tag generation for source ID: ${sourceId}`);

      console.log(`[Worker:AssembleNote] Generating tags for source ID: ${sourceId}...`);
      // Pass sourceTextForTags instead of markdownContent
      const generatedTagNames = await aiService.generateTags(sourceTextForTags, finalLanguageCode);
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
        // Language code (ISO 639-3) from dedicated column, default to 'eng'
        const finalLanguageCode = sourceRecord.languageCode || 'eng';

        // Insert the note
        const insertedNotes = await tx.insert(notes).values({
            sourceId: sourceId,
            userId: sourceRecord!.userId, // Non-null after check
            title: aiStructure.title,
            summary: aiStructure.summary,
            markdownContent: null, // Set markdownContent to null as we generate HTML directly
            htmlContent: htmlContent,
            favorite: false,
            sourceType: finalSourceType,
            languageCode: finalLanguageCode, // Save the ISO 639-3 code
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