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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAssembleNoteJob = handleAssembleNoteJob;
const handlebars_1 = __importDefault(require("handlebars"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const logger_1 = require("../logger/logger");
const ai_types_1 = require("../../modules/ai/types/ai.types");
// ==============================================
// Handlebars Setup
// ==============================================
// ---- Partials Loading (Modified) ----
function loadPartials(HB, // Accept Handlebars instance
partialsDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const partialsMap = {};
        try {
            const filenames = yield promises_1.default.readdir(partialsDir);
            // Use Promise.all to wait for all async operations
            yield Promise.all(filenames.map((filename) => __awaiter(this, void 0, void 0, function* () {
                if (filename.endsWith('.hbs')) {
                    const partialName = path_1.default.basename(filename, '.hbs');
                    const filepath = path_1.default.join(partialsDir, filename);
                    const template = yield promises_1.default.readFile(filepath, 'utf8');
                    HB.registerPartial(partialName, template); // Register on the passed instance
                    // Compile and store separately for the map needed by the template's lookup
                    partialsMap[partialName] = HB.compile(template, { noEscape: true });
                    // logger.info(`Registered partial: ${partialName}`); // Log inside if needed
                }
            })));
            logger_1.logger.info(`Total partials loaded and registered: ${Object.keys(HB.partials).length}`);
        }
        catch (error) {
            logger_1.logger.error('Error loading Handlebars partials:', error);
            throw error;
        }
        return partialsMap; // Return the map of compiled partials
    });
}
// ==============================================
// Content Type Normalization
// ==============================================
function normalizeType(raw) {
    if (!raw)
        return 'paragraph'; // Default to paragraph if undefined/empty
    return raw
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w\-]/g, '');
}
// Recursive function to normalize contentTypes in the structure
function normalizeStructure(blocks) {
    if (!Array.isArray(blocks)) {
        return;
    }
    blocks.forEach((block) => {
        // Cast the result of normalizeType to the specific enum type
        block.contentType = normalizeType(block.contentType);
        if (block.subStructure) {
            normalizeStructure(block.subStructure);
        }
    });
}
// ==============================================
// Visual Hydration Logic
// ==============================================
// Function to recursively hydrate visual placeholders in the structure
function hydrateVisuals(blocks, visualsMap) {
    if (!Array.isArray(blocks)) {
        return;
    }
    blocks.forEach((block) => {
        var _a, _b, _c, _d, _e;
        if (block.contentType === 'visual_placeholder' && block.placeholderId) {
            const visualData = visualsMap.get(block.placeholderId);
            // <<< Add detailed logging for VISUAL_3 >>>
            if (block.placeholderId === 'VISUAL_3') {
                logger_1.logger.info({
                    placeholderId: block.placeholderId,
                    foundVisualData: visualData ? { id: visualData.id, status: visualData.status, imageUrl: ((_a = visualData.imageUrl) === null || _a === void 0 ? void 0 : _a.substring(0, 50)) + '...' } : null
                }, 'Processing VISUAL_3 inside hydrateVisuals');
            }
            // <<< End logging >>>
            if (visualData) {
                if (visualData.status === 'COMPLETED' && visualData.imageUrl) {
                    // Hydrate with successful visual data
                    block.contentType = 'visual';
                    block.imageUrl = visualData.imageUrl;
                    block.altText = (_b = visualData.altText) !== null && _b !== void 0 ? _b : visualData.placeholderId; // Fallback alt text
                    block.sourceUrl = (_c = visualData.sourceUrl) !== null && _c !== void 0 ? _c : undefined; // Use nullish coalescing for type compatibility
                    block.sourceTitle = (_d = visualData.sourceTitle) !== null && _d !== void 0 ? _d : undefined; // Use nullish coalescing for type compatibility
                    // Remove placeholder-specific fields if they exist
                    delete block.placeholderId;
                    delete block.description;
                }
                else {
                    // Replace with placeholder for failed/pending visuals
                    block.contentType = 'placeholder';
                    block.reason = (_e = visualData.errorMessage) !== null && _e !== void 0 ? _e : 'Visual processing is not complete or failed.';
                    // Remove placeholder-specific fields if they exist
                    delete block.placeholderId;
                    // Keep description as it might be useful context for the failure
                }
            }
            else {
                // Visual data not found in map (should not happen if process is correct)
                logger_1.logger.warn(`Visual data not found for placeholderId: ${block.placeholderId}`);
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
function checkContentTypes(blocks, knownTypes) {
    if (!Array.isArray(blocks)) {
        return;
    }
    blocks.forEach((block) => {
        var _a;
        if (!knownTypes.has(block.contentType)) {
            // Log details about the block causing the error
            const errorContext = {
                contentType: block.contentType,
                contentPreview: (_a = block.content) === null || _a === void 0 ? void 0 : _a.substring(0, 50),
                placeholderId: block.placeholderId,
                blockKeys: Object.keys(block),
            };
            logger_1.logger.error({ errorContext }, `Discovered unknown contentType during whitelist check: ${block.contentType}`);
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
function handleAssembleNoteJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const { sourceId } = job.data;
        logger_1.logger.info({ sourceId }, `Starting ASSEMBLE_NOTE job for source ID: ${sourceId}`);
        // Create a fresh Handlebars instance for this job run
        const HB = handlebars_1.default.create();
        let sourceRecord;
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
            const partialsDir = path_1.default.join(__dirname, '../../templates/partials');
            const partialsMap = yield loadPartials(HB, partialsDir);
            const knownPartialNames = new Set(Object.keys(partialsMap));
            // Load and compile main template using the isolated instance
            const mainTemplatePath = path_1.default.join(__dirname, '../../templates/main-note.hbs');
            const mainTemplateContent = yield promises_1.default.readFile(mainTemplatePath, 'utf8');
            const compiledMainTemplate = HB.compile(mainTemplateContent, { noEscape: true });
            // --- End Handlebars Setup ---
            // 1. Fetch Source Record
            sourceRecord = yield index_1.db.query.sources.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
            });
            if (!sourceRecord)
                throw new Error(`Source record not found for ID: ${sourceId}`);
            if (!sourceRecord.metadata)
                throw new Error(`Source record metadata missing for ID: ${sourceId}.`);
            // 2. Extract and Parse Lesson Structure
            const metadata = sourceRecord.metadata;
            const lessonStructureJson = metadata.lessonStructureJson;
            if (!lessonStructureJson)
                throw new Error(`Source ${sourceId} is missing lessonStructureJson.`);
            let parsedStructure;
            try {
                parsedStructure = ai_types_1.aiStructuredContentSchema.parse(lessonStructureJson);
            }
            catch (parseError) {
                logger_1.logger.error({ sourceId, parseError }, 'Failed to parse lessonStructureJson');
                throw new Error(`Invalid lessonStructureJson format for source ${sourceId}.`);
            }
            // 5. Fetch Associated Visuals
            const visualRecords = yield index_1.db.query.visuals.findMany({
                where: (0, drizzle_orm_1.eq)(schema_1.visuals.sourceId, sourceId),
            });
            logger_1.logger.info({ sourceId, visualCount: visualRecords.length }, 'Fetched visuals.');
            // 6. Populate Visuals Map
            const visualsMap = new Map();
            visualRecords.forEach(record => {
                if (record.placeholderId)
                    visualsMap.set(record.placeholderId, record);
            });
            // 7. Hydrate Visuals in the Structure
            hydrateVisuals(parsedStructure.structure, visualsMap);
            logger_1.logger.info({ sourceId }, 'Hydrated visual placeholders.');
            // 8. Normalize Content Types **AFTER** hydration
            normalizeStructure(parsedStructure.structure);
            logger_1.logger.info({ sourceId }, 'Normalized content types in structure.');
            // 9. Whitelist Check (Run only in development, AFTER normalization)
            if (process.env.NODE_ENV === 'development') {
                logger_1.logger.info({ sourceId }, 'Running development content type whitelist check...');
                checkContentTypes(parsedStructure.structure, knownPartialNames);
                logger_1.logger.info({ sourceId }, 'Whitelist check passed.');
            }
            // <<< ADD LOGGING HERE >>>
            // Add more detailed logging right before rendering to inspect the final state
            if (process.env.NODE_ENV === 'development') {
                logger_1.logger.info({
                    sourceId,
                    partialsMapKeys: Array.from(knownPartialNames),
                    structureSample: parsedStructure.structure.slice(0, 3).map(block => {
                        var _a, _b;
                        return ({
                            contentType: block.contentType,
                            contentPreview: (_a = block.content) === null || _a === void 0 ? void 0 : _a.substring(0, 30),
                            subStructureSample: (_b = block.subStructure) === null || _b === void 0 ? void 0 : _b.slice(0, 2).map(sub => ({ contentType: sub.contentType }))
                        });
                    })
                }, "State before rendering");
            }
            // 10. Prepare Template Data (Pass the compiled partials map)
            const templateData = {
                title: (_a = parsedStructure.title) !== null && _a !== void 0 ? _a : 'Untitled Note',
                summary: (_b = parsedStructure.summary) !== null && _b !== void 0 ? _b : '',
                structure: parsedStructure.structure,
                partialsMap: partialsMap, // Pass map for the template's lookup helper
            };
            // 11. Render HTML (Uses the compiled template from isolated HB instance)
            const generatedHtml = compiledMainTemplate(templateData);
            logger_1.logger.info({ sourceId }, 'Rendered HTML template.');
            // 12. Create/Update Note Record
            const existingNote = yield index_1.db.query.notes.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.notes.sourceId, sourceId),
                columns: { id: true },
            });
            let noteId;
            if (existingNote) {
                // Update existing note
                noteId = existingNote.id;
                yield index_1.db.update(schema_1.notes).set({
                    title: (_c = parsedStructure.title) !== null && _c !== void 0 ? _c : 'Untitled Note',
                    summary: (_d = parsedStructure.summary) !== null && _d !== void 0 ? _d : '',
                    htmlContent: generatedHtml,
                    sourceType: sourceRecord.sourceType,
                    languageCode: sourceRecord.languageCode,
                    updatedAt: new Date(),
                }).where((0, drizzle_orm_1.eq)(schema_1.notes.id, noteId));
                logger_1.logger.info({ noteId, sourceId }, `Updated existing note.`);
            }
            else {
                // Insert new note
                if (!sourceRecord.userId)
                    throw new Error(`UserId missing on source ${sourceId}.`);
                const newNoteResult = yield index_1.db.insert(schema_1.notes).values({
                    sourceId: sourceId,
                    userId: sourceRecord.userId,
                    title: (_e = parsedStructure.title) !== null && _e !== void 0 ? _e : 'Untitled Note',
                    summary: (_f = parsedStructure.summary) !== null && _f !== void 0 ? _f : '',
                    htmlContent: generatedHtml,
                    markdownContent: '',
                    languageCode: sourceRecord.languageCode,
                    sourceType: sourceRecord.sourceType,
                    favorite: false,
                }).returning({ id: schema_1.notes.id });
                if (!((_g = newNoteResult === null || newNoteResult === void 0 ? void 0 : newNoteResult[0]) === null || _g === void 0 ? void 0 : _g.id))
                    throw new Error(`Failed to insert note for source ${sourceId}`);
                noteId = newNoteResult[0].id;
                logger_1.logger.info({ noteId, sourceId }, `Created new note.`);
            }
            // 13. Update Source Status to COMPLETED
            yield index_1.db.update(schema_1.sources).set({
                processingStatus: 'COMPLETED',
                processingStage: 'Note Assembled',
                processingError: null,
                updatedAt: new Date(),
            }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            logger_1.logger.info({ sourceId, noteId }, `Marked source ${sourceId} as COMPLETED.`);
        }
        catch (error) {
            logger_1.logger.error({ sourceId, error: error.message, stack: error.stack }, `Error in ASSEMBLE_NOTE job for source ${sourceId}`);
            // Update source status to FAILED
            if (sourceId) {
                try {
                    yield index_1.db.update(schema_1.sources).set({
                        processingStatus: 'FAILED',
                        processingStage: 'Note Assembly Error',
                        processingError: error.message || 'Unknown assembly error',
                        updatedAt: new Date(),
                    }).where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
                }
                catch (dbError) {
                    logger_1.logger.error({ sourceId, dbError: dbError.message }, 'Failed to update source status to FAILED.');
                }
            }
            throw error; // Re-throw for BullMQ
        }
    });
}
