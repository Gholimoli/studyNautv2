import { relations } from 'drizzle-orm';
import { boolean, integer, json, pgTable, serial, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users, notes, visuals } from '../schema';

export const sourceTypeEnum = pgEnum('source_type', ['YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE']);
export const processingStatusEnum = pgEnum('processing_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);

export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceType: sourceTypeEnum('source_type').notNull(),
  originalUrl: text('original_url'),
  originalFilename: text('original_filename'),
  originalStoragePath: text('original_storage_path'), // New column for Supabase path
  processingStatus: processingStatusEnum('processing_status').default('PENDING').notNull(),
  processingStage: text('processing_stage').default('WAITING_FOR_TRANSCRIPTION'), // e.g., 'TRANSCRIBING', 'ANALYZING', 'GENERATING_VISUALS'
  processingError: text('processing_error'),
  extractedText: text('extracted_text'), // Store extracted text/transcript here
  metadata: json('metadata'), // Store things like video title, duration, language, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  user: one(users, {
    fields: [sources.userId],
    references: [users.id],
  }),
  note: one(notes, {
    fields: [sources.id],
    references: [notes.sourceId],
  }),
  visuals: many(visuals), // A source can have multiple visual elements
})); 