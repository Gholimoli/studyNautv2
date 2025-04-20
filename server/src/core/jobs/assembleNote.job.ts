import { Job } from 'bullmq';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db/index';
import { notes, visuals, sources } from '../db/schema';
import { eq, InferModel } from 'drizzle-orm';
import { logger } from '../logger/logger';
import {
  AiStructuredContent,
  LessonBlock,
  aiStructuredContentSchema,
} from '../../modules/ai/types/ai.types';

// Infer types from the table definitions
type Source = InferModel<typeof sources, 'select'>;
type Note = InferModel<typeof notes, 'select'>;
type Visual = InferModel<typeof visuals, 'select'>;
type VisualRecord = Visual;

// Define the metadata type for source records
interface SourceMetadata {
  lessonStructureJson?: AiStructuredContent;
  [key: string]: unknown;
}

// Define the payload for this job
interface AssembleNotePayload {
  sourceId: number;
}

// ==============================================
// Handlebars Setup
// ==============================================

// ---- Partials Loading (Modified) ----

async function loadPartials(
  HB: typeof Handlebars, // Accept Handlebars instance
  partialsDir: string,
): Promise<Record<string, Handlebars.TemplateDelegate>> {
  const partialsMap: Record<string, Handlebars.TemplateDelegate> = {};
  try {
    const filenames = await fs.readdir(partialsDir);
    // Use Promise.all to wait for all async operations
    await Promise.all(
      filenames.map(async (filename) => {
        if (filename.endsWith('.hbs')) {
          const partialName = path.basename(filename, '.hbs');
          const filepath = path.join(partialsDir, filename);
          const template = await fs.readFile(filepath, 'utf8');
          HB.registerPartial(partialName, template); // Register on the passed instance
          // Compile and store separately for the map needed by the template's lookup
          partialsMap[partialName] = HB.compile(template, { noEscape: true }); 
          // logger.info(`Registered partial: ${partialName}`); // Log inside if needed
        }
      }),
    );
    logger.info(`Total partials loaded and registered: ${Object.keys(HB.partials).length}`);
  } catch (error) {
    logger.error('Error loading Handlebars partials:', error);
    throw error;
  }
  return partialsMap; // Return the map of compiled partials
}

// ==============================================
// Content Type Normalization
// ==============================================

function normalizeType(raw?: string): string {
  if (!raw) return 'paragraph'; // Default to paragraph if undefined/empty
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-') 
    .replace(/[^\w\-]/g, '');
}

// Recursive function to normalize contentTypes in the structure
function normalizeStructure(blocks: LessonBlock[]): void {
  if (!Array.isArray(blocks)) {
    return;
  }
  blocks.forEach((block) => {
    // Cast the result of normalizeType to the specific enum type
    block.contentType = normalizeType(block.contentType) as LessonBlock['contentType'];
    if (block.subStructure) {
      normalizeStructure(block.subStructure);
    }
  });
}

// ==============================================
// Visual Hydration Logic
// ==============================================

// Function to recursively hydrate visual placeholders in the structure
function hydrateVisuals(blocks: LessonBlock[], visualsMap: Map<string, VisualRecord>): void {
  if (!Array.isArray(blocks)) {
    return;
  }

  blocks.forEach((block) => {
    if (block.contentType === 'visual_placeholder' && block.placeholderId) {
      const visualData = visualsMap.get(block.placeholderId);
      
      // <<< Add detailed logging for VISUAL_3 >>>
      if (block.placeholderId === 'VISUAL_3') {
          logger.info({ 
              placeholderId: block.placeholderId,
              foundVisualData: visualData ? { id: visualData.id, status: visualData.status, imageUrl: visualData.imageUrl?.substring(0, 50)+'...' } : null 
          }, 'Processing VISUAL_3 inside hydrateVisuals');
      }
      // <<< End logging >>>
      
      if (visualData) {
        if (visualData.status === 'COMPLETED' && visualData.imageUrl) {
          // Hydrate with successful visual data
          block.contentType = 'visual';
          block.imageUrl = visualData.imageUrl;
          block.altText = visualData.altText ?? visualData.placeholderId; // Fallback alt text
          block.sourceUrl = visualData.sourceUrl ?? undefined; // Use nullish coalescing for type compatibility
          block.sourceTitle = visualData.sourceTitle ?? undefined; // Use nullish coalescing for type compatibility
          // Remove placeholder-specific fields if they exist
          delete block.placeholderId;
          delete block.description;
        } else {
          // Replace with placeholder for failed/pending visuals
          block.contentType = 'placeholder';
          block.reason = visualData.errorMessage ?? 'Visual processing is not complete or failed.';
          // Remove placeholder-specific fields if they exist
          delete block.placeholderId;
          // Keep description as it might be useful context for the failure
        }
      } else {
        // Visual data not found in map (should not happen if process is correct)
        logger.warn(`Visual data not found for placeholderId: ${block.placeholderId}`);
        block.contentType = 'placeholder';
        block.reason = `Data for visual placeholder ${block.placeholderId} was unexpectedly missing.`;
        delete block.placeholderId;
      }
    }

    // Recursively process subStructure if it exists
    if (block.subStructure && Array.isArray(block.subStructure)) {
      hydrateVisuals(block.subStructure, visualsMap);
    }
  });
}

// ==============================================
// Whitelist Check (Dev Only)
// ==============================================

function checkContentTypes(blocks: LessonBlock[], knownTypes: Set<string>): void {
  if (!Array.isArray(blocks)) {
    return;
  }
  blocks.forEach((block) => {
    if (!knownTypes.has(block.contentType)) {
        // Log details about the block causing the error
        const errorContext = {
            contentType: block.contentType,
            contentPreview: block.content?.substring(0, 50),
            placeholderId: block.placeholderId,
            blockKeys: Object.keys(block),
        };
        logger.error({ errorContext }, `Discovered unknown contentType during whitelist check: ${block.contentType}`);
        throw new Error(`Unknown contentType "${block.contentType}" encountered during assembly.`);
    }
    if (block.subStructure) {
      checkContentTypes(block.subStructure, knownTypes);
    }
  });
}

// ==============================================
// Main Job Handler (Modified)
// ==============================================

export async function handleAssembleNoteJob(
  job: Job<AssembleNotePayload>,
): Promise<void> {
  const { sourceId } = job.data;
  logger.info({ sourceId }, `Starting ASSEMBLE_NOTE job for source ID: ${sourceId}`);

  // Create a fresh Handlebars instance for this job run
  const HB = Handlebars.create();

  let sourceRecord: Source | undefined;
  try {
    // --- Handlebars Setup within Job ---
    // Register helpers on the isolated instance
    HB.registerHelper('eq', function (a, b) { return a === b; });
    HB.registerHelper('lookupPretty', function (obj, field) {
      const partialName = obj && obj[field] ? obj[field] : 'default';
      return partialName;
    });
    HB.registerHelper('or', function (a, b) { return a || b; });

    // Load partials using the isolated instance and await completion
    const partialsDir = path.join(__dirname, '../../templates/partials');
    const partialsMap = await loadPartials(HB, partialsDir);
    const knownPartialNames = new Set(Object.keys(partialsMap));

    // Load and compile main template using the isolated instance
    const mainTemplatePath = path.join(__dirname, '../../templates/main-note.hbs');
    const mainTemplateContent = await fs.readFile(mainTemplatePath, 'utf8');
    const compiledMainTemplate = HB.compile(mainTemplateContent, { noEscape: true });
    // --- End Handlebars Setup ---

    // 1. Fetch Source Record
    sourceRecord = await db.query.sources.findFirst({
      where: eq(sources.id, sourceId),
    });
    if (!sourceRecord) throw new Error(`Source record not found for ID: ${sourceId}`);
    if (!sourceRecord.metadata) throw new Error(`Source record metadata missing for ID: ${sourceId}.`);

    // 2. Extract and Parse Lesson Structure
    const metadata = sourceRecord.metadata as SourceMetadata;
    const lessonStructureJson = metadata.lessonStructureJson;
    if (!lessonStructureJson) throw new Error(`Source ${sourceId} is missing lessonStructureJson.`);
    
    let parsedStructure: AiStructuredContent;
    try {
      parsedStructure = aiStructuredContentSchema.parse(lessonStructureJson);
    } catch (parseError) {
      logger.error({ sourceId, parseError }, 'Failed to parse lessonStructureJson');
      throw new Error(`Invalid lessonStructureJson format for source ${sourceId}.`);
    }

    // 5. Fetch Associated Visuals
    const visualRecords: VisualRecord[] = await db.query.visuals.findMany({
      where: eq(visuals.sourceId, sourceId),
    });
    logger.info({ sourceId, visualCount: visualRecords.length }, 'Fetched visuals.');

    // 6. Populate Visuals Map
    const visualsMap = new Map<string, VisualRecord>();
    visualRecords.forEach(record => {
      if (record.placeholderId) visualsMap.set(record.placeholderId, record);
    });

    // 7. Hydrate Visuals in the Structure
    hydrateVisuals(parsedStructure.structure, visualsMap);
    logger.info({ sourceId }, 'Hydrated visual placeholders.');

    // 8. Normalize Content Types **AFTER** hydration
    normalizeStructure(parsedStructure.structure);
    logger.info({ sourceId }, 'Normalized content types in structure.');

    // 9. Whitelist Check (Run only in development, AFTER normalization)
    if (process.env.NODE_ENV === 'development') {
      logger.info({ sourceId }, 'Running development content type whitelist check...');
      checkContentTypes(parsedStructure.structure, knownPartialNames);
      logger.info({ sourceId }, 'Whitelist check passed.');
    }

    // <<< ADD LOGGING HERE >>>
    // Add more detailed logging right before rendering to inspect the final state
    if (process.env.NODE_ENV === 'development') {
        logger.info({
            sourceId,
            partialsMapKeys: Array.from(knownPartialNames),
            structureSample: parsedStructure.structure.slice(0, 3).map(block => ({
                contentType: block.contentType,
                contentPreview: block.content?.substring(0, 30),
                subStructureSample: block.subStructure?.slice(0, 2).map(sub => ({ contentType: sub.contentType }))
            }))
        }, "State before rendering");
    }

    // 10. Prepare Template Data (Pass the compiled partials map)
    const templateData = {
      title: parsedStructure.title ?? 'Untitled Note',
      summary: parsedStructure.summary ?? '',
      structure: parsedStructure.structure,
      partialsMap: partialsMap, // Pass map for the template's lookup helper
    };

    // 11. Render HTML (Uses the compiled template from isolated HB instance)
    const generatedHtml = compiledMainTemplate(templateData);
    logger.info({ sourceId }, 'Rendered HTML template.');

    // 12. Create/Update Note Record
    const existingNote = await db.query.notes.findFirst({
      where: eq(notes.sourceId, sourceId),
      columns: { id: true },
    });

    let noteId: number;
    if (existingNote) {
      // Update existing note
      noteId = existingNote.id;
      await db.update(notes).set({
        title: parsedStructure.title ?? 'Untitled Note',
        summary: parsedStructure.summary ?? '',
        htmlContent: generatedHtml,
        sourceType: sourceRecord.sourceType,
        languageCode: sourceRecord.languageCode,
        updatedAt: new Date(),
      }).where(eq(notes.id, noteId));
      logger.info({ noteId, sourceId }, `Updated existing note.`);
    } else {
      // Insert new note
      if (!sourceRecord.userId) throw new Error(`UserId missing on source ${sourceId}.`);
      const newNoteResult = await db.insert(notes).values({
        sourceId: sourceId,
        userId: sourceRecord.userId,
        title: parsedStructure.title ?? 'Untitled Note',
        summary: parsedStructure.summary ?? '',
        htmlContent: generatedHtml,
        markdownContent: '', 
        languageCode: sourceRecord.languageCode,
        sourceType: sourceRecord.sourceType,
        favorite: false,
      }).returning({ id: notes.id });
      if (!newNoteResult?.[0]?.id) throw new Error(`Failed to insert note for source ${sourceId}`);
      noteId = newNoteResult[0].id;
      logger.info({ noteId, sourceId }, `Created new note.`);
    }
    
    // 13. Update Source Status to COMPLETED
    await db.update(sources).set({ 
      processingStatus: 'COMPLETED',
      processingStage: 'Note Assembled',
      processingError: null,
      updatedAt: new Date(),
    }).where(eq(sources.id, sourceId));
    logger.info({ sourceId, noteId }, `Marked source ${sourceId} as COMPLETED.`);

  } catch (error: any) {
    logger.error(
      { sourceId, error: error.message, stack: error.stack },
      `Error in ASSEMBLE_NOTE job for source ${sourceId}`,
    );
    // Update source status to FAILED
    if (sourceId) { 
      try {
        await db.update(sources).set({
          processingStatus: 'FAILED',
          processingStage: 'Note Assembly Error',
          processingError: error.message || 'Unknown assembly error',
          updatedAt: new Date(),
        }).where(eq(sources.id, sourceId));
      } catch (dbError: any) {
        logger.error({ sourceId, dbError: dbError.message }, 'Failed to update source status to FAILED.');
      }
    }
    throw error; // Re-throw for BullMQ
  }
}