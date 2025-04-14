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
exports.assembleNoteJob = assembleNoteJob;
const db_1 = require("../../core/db");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const marked_1 = require("marked"); // For Markdown to HTML conversion
/**
 * Job processor for assembling the final note content.
 */
function assembleNoteJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { sourceId } = job.data;
        console.log(`[Worker:AssembleNote] Starting job for source ID: ${sourceId}`);
        let sourceRecord;
        try {
            yield db_1.db.update(schema_1.sources)
                .set({ processingStage: 'ASSEMBLING_NOTE' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            sourceRecord = yield db_1.db.query.sources.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId),
                with: {
                    visuals: true,
                }
            });
            if (!sourceRecord || !sourceRecord.metadata || !sourceRecord.metadata.aiStructure) {
                throw new Error(`Source record or AI structure not found for ID: ${sourceId}`);
            }
            if (!sourceRecord.userId) {
                throw new Error(`Source record missing userId for ID: ${sourceId}`);
            }
            const aiStructure = sourceRecord.metadata.aiStructure;
            const fetchedVisuals = sourceRecord.visuals || [];
            const visualMap = new Map();
            fetchedVisuals.forEach(v => {
                if (v.placeholderId) {
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
                        (_a = block.items) === null || _a === void 0 ? void 0 : _a.forEach(item => markdownContent += `* ${item}\n`);
                        markdownContent += '\n';
                        break;
                    case 'key_term':
                        markdownContent += `**${block.content}**\n\n`;
                        break;
                    case 'visual_placeholder':
                        if (block.placeholderId) {
                            const visual = visualMap.get(block.placeholderId);
                            if ((visual === null || visual === void 0 ? void 0 : visual.status) === 'COMPLETED' && visual.url) {
                                markdownContent += `![${block.content || 'Visual Content'}](${visual.url})\n*${block.content || 'Visual Content'}*\n\n`;
                            }
                            else {
                                markdownContent += `\n<div class="p-4 border border-dashed border-muted-foreground rounded-md my-4 text-center text-muted-foreground">`;
                                markdownContent += `<p class="font-semibold">Visual Placeholder: ${block.content || block.placeholderId}</p>`;
                                markdownContent += `<p class="text-sm">${(visual === null || visual === void 0 ? void 0 : visual.status) === 'FAILED' ? '(Image generation failed)' : '(Image pending or failed)'}</p>`;
                                markdownContent += `</div>\n\n`; // Use HTML for better fallback styling
                            }
                        }
                        else {
                            markdownContent += `\n<div class="p-4 border border-dashed border-destructive rounded-md my-4 text-center text-destructive">[Visual Placeholder: Invalid ID]</div>\n\n`;
                        }
                        break;
                }
            }
            marked_1.marked.setOptions({
                gfm: true,
                breaks: true,
            });
            const htmlContent = marked_1.marked.parse(markdownContent);
            // Use transaction for note creation and source update?
            yield db_1.db.insert(schema_1.notes).values({
                sourceId: sourceId,
                userId: sourceRecord.userId,
                title: aiStructure.title,
                sourceType: sourceRecord.sourceType,
                markdownContent: markdownContent,
                htmlContent: htmlContent,
                favorite: false,
            });
            console.log(`[Worker:AssembleNote] Note record created for source ID: ${sourceId}`);
            yield db_1.db.update(schema_1.sources)
                .set({ processingStatus: 'COMPLETED', processingStage: 'COMPLETED' })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            console.log(`[Worker:AssembleNote] Successfully finished job for source ID: ${sourceId}. Source marked COMPLETED.`);
        }
        catch (error) {
            console.error(`[Worker:AssembleNote] Error processing job for source ID: ${sourceId}`, error);
            yield db_1.db.update(schema_1.sources)
                .set({
                processingStatus: 'FAILED',
                processingError: error instanceof Error ? error.message : 'Error assembling note content',
                processingStage: 'ASSEMBLING_NOTE'
            })
                .where((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId));
            throw error;
        }
    });
}
