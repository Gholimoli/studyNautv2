import { pgTable, serial, text, varchar, timestamp, pgEnum, integer, jsonb, boolean, AnyPgColumn, primaryKey } from 'drizzle-orm/pg-core';
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

export const folders = pgTable('folders', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id').references((): AnyPgColumn => folders.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceType: text('source_type', { enum: ['YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE'] }).notNull(),
  originalUrl: text('original_url'),
  originalFilename: text('original_filename'),
  originalStoragePath: text('original_storage_path'),
  extractedText: text('extracted_text'),
  languageCode: varchar('language_code', { length: 3 }),
  metadata: jsonb('metadata').default({}),
  processingStatus: text('processing_status', { enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] }).notNull().default('PENDING'),
  processingStage: text('processing_stage'),
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
  folderId: integer('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary'),
  markdownContent: text('markdown_content'),
  htmlContent: text('html_content'),
  languageCode: varchar('language_code', { length: 10 }),
  favorite: boolean('favorite').default(false).notNull(),
  sourceType: sourceTypeEnum('source_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- NEW Tags Table --- 
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // Ensure tag names are unique
});

// --- NEW Notes <-> Tags Join Table --- 
export const notesToTags = pgTable('notes_tags',
  {
    noteId: integer('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  },
  // Define composite primary key
  (t) => ({
    pk: primaryKey({ columns: [t.noteId, t.tagId] }),
  })
);

// Add other tables (sources, notes, visuals, etc.) here later

// --- Relations --- 

export const usersRelations = relations(users, ({ many }) => ({
	sources: many(sources),
    notes: many(notes),
    folders: many(folders),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
    user: one(users, {
        fields: [folders.userId],
        references: [users.id],
    }),
    parent: one(folders, {
        fields: [folders.parentId],
        references: [folders.id],
        relationName: 'folderHierarchy',
    }),
    children: many(folders, {
        relationName: 'folderHierarchy',
    }),
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

export const notesRelations = relations(notes, ({ one, many }) => ({
    source: one(sources, {
        fields: [notes.sourceId],
        references: [sources.id],
    }),
    user: one(users, {
        fields: [notes.userId],
        references: [users.id],
    }),
    folder: one(folders, {
        fields: [notes.folderId],
        references: [folders.id],
    }),
    // Add relation to join table
    notesToTags: many(notesToTags),
}));

// --- ADD tagsRelations --- 
export const tagsRelations = relations(tags, ({ many }) => ({
  notesToTags: many(notesToTags),
}));

// --- ADD notesToTagsRelations --- 
export const notesToTagsRelations = relations(notesToTags, ({ one }) => ({
  note: one(notes, {
    fields: [notesToTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [notesToTags.tagId],
    references: [tags.id],
  }),
}));