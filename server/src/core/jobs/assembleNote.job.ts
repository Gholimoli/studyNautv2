import { Job } from 'bullmq';
import { db } from '../db/index';
import { sources, visuals, notes } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AiStructuredContent, LessonBlock } from '../../modules/ai/types/ai.types';
import { AssembleNotePayload } from './job.definition';
import { marked } from 'marked'; // For Markdown to HTML conversion

/**
 * Job processor for assembling the final note content.
 */
export async function assembleNoteJob(job: Job<AssembleNotePayload>): Promise<void> {
  const { sourceId } = job.data;
  console.log(`[Worker:AssembleNote] Starting job for source ID: ${sourceId}`);

  let sourceRecord;
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

    if (!sourceRecord || !sourceRecord.metadata || !(sourceRecord.metadata as any).aiStructure) {
      throw new Error(`Source record or AI structure not found for ID: ${sourceId}`);
    }
    if (!sourceRecord.userId) {
         throw new Error(`Source record missing userId for ID: ${sourceId}`);
    }

    const aiStructure = (sourceRecord.metadata as any).aiStructure as AiStructuredContent;
    const fetchedVisuals = sourceRecord.visuals || [];
    const visualMap = new Map<string, { url: string | null, status: string }>();
    fetchedVisuals.forEach(v => {
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

    // Use transaction for note creation and source update?
    await db.insert(notes).values({
        sourceId: sourceId,
        userId: sourceRecord.userId,
        title: aiStructure.title,
        markdownContent: markdownContent,
        htmlContent: htmlContent,
        favorite: false,
    });
    console.log(`[Worker:AssembleNote] Note record created for source ID: ${sourceId}`);

    await db.update(sources)
      .set({ processingStatus: 'COMPLETED', processingStage: 'COMPLETED' })
      .where(eq(sources.id, sourceId));

    console.log(`[Worker:AssembleNote] Successfully finished job for source ID: ${sourceId}. Source marked COMPLETED.`);

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