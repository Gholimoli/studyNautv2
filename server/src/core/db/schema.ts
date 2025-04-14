import { pgTable, serial, text, varchar, timestamp, pgEnum, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Enums --- 
export const sourceTypeEnum = pgEnum('source_type', ['YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE']);
export const processingStatusEnum = pgEnum('processing_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
export const visualStatusEnum = pgEnum('visual_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
// TODO: Add processingStageEnum later as stages become clearer

// --- Tables --- 

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).default('USER').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceType: sourceTypeEnum('source_type').notNull(),
  originalUrl: varchar('original_url', { length: 2048 }),
  originalFilename: varchar('original_filename', { length: 255 }),
  extractedText: text('extracted_text'),
  metadata: jsonb('metadata'),
  processingStatus: processingStatusEnum('processing_status').default('PENDING').notNull(),
  processingStage: varchar('processing_stage', { length: 100 }),
  processingError: text('processing_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const visuals = pgTable('visuals', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  placeholderId: varchar('placeholder_id', { length: 255 }).notNull(),
  description: text('description').notNull(),
  searchQuery: text('search_query'),
  status: visualStatusEnum('status').default('PENDING').notNull(),
  imageUrl: varchar('image_url', { length: 2048 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }).unique(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  markdownContent: text('markdown_content'),
  htmlContent: text('html_content'),
  favorite: boolean('favorite').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Add other tables (sources, notes, visuals, etc.) here later

// --- Relations --- 

export const usersRelations = relations(users, ({ many }) => ({
	sources: many(sources),
    notes: many(notes),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
	user: one(users, {
		fields: [sources.userId],
		references: [users.id],
	}),
    visuals: many(visuals),
    note: one(notes, {
        fields: [sources.id],
        references: [notes.sourceId]
    }), 
}));

export const visualsRelations = relations(visuals, ({ one }) => ({
    source: one(sources, {
        fields: [visuals.sourceId],
        references: [sources.id],
    }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
    source: one(sources, {
        fields: [notes.sourceId],
        references: [sources.id],
    }),
    user: one(users, {
        fields: [notes.userId],
        references: [users.id],
    }),
}));