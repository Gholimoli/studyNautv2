"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notesToTagsRelations = exports.tagsRelations = exports.notesRelations = exports.visualsRelations = exports.sourcesRelations = exports.foldersRelations = exports.usersRelations = exports.notesToTags = exports.tags = exports.notes = exports.visuals = exports.sources = exports.folders = exports.users = exports.visualStatusEnum = exports.processingStatusEnum = exports.sourceTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// --- Enums --- 
exports.sourceTypeEnum = (0, pg_core_1.pgEnum)('source_type', ['YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE']);
exports.processingStatusEnum = (0, pg_core_1.pgEnum)('processing_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
exports.visualStatusEnum = (0, pg_core_1.pgEnum)('visual_status', ['PENDING', 'PENDING_GENERATION', 'PROCESSING', 'COMPLETED', 'FAILED', 'NO_IMAGE_FOUND']);
// TODO: Add processingStageEnum later as stages become clearer
// --- Tables --- 
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    username: (0, pg_core_1.varchar)('username', { length: 50 }).notNull().unique(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    displayName: (0, pg_core_1.varchar)('display_name', { length: 100 }),
    avatarUrl: (0, pg_core_1.text)('avatar_url'),
    role: (0, pg_core_1.varchar)('role', { length: 50 }).default('USER').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.folders = (0, pg_core_1.pgTable)('folders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    parentId: (0, pg_core_1.integer)('parent_id').references(() => exports.folders.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.sources = (0, pg_core_1.pgTable)('sources', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    sourceType: (0, pg_core_1.text)('source_type', { enum: ['YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE'] }).notNull(),
    originalUrl: (0, pg_core_1.text)('original_url'),
    originalFilename: (0, pg_core_1.text)('original_filename'),
    originalStoragePath: (0, pg_core_1.text)('original_storage_path'),
    extractedText: (0, pg_core_1.text)('extracted_text'),
    languageCode: (0, pg_core_1.varchar)('language_code', { length: 3 }),
    metadata: (0, pg_core_1.jsonb)('metadata').default({}),
    processingStatus: (0, pg_core_1.text)('processing_status', { enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] }).notNull().default('PENDING'),
    processingStage: (0, pg_core_1.text)('processing_stage'),
    processingError: (0, pg_core_1.text)('processing_error'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.visuals = (0, pg_core_1.pgTable)('visuals', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    sourceId: (0, pg_core_1.integer)('source_id').notNull().references(() => exports.sources.id, { onDelete: 'cascade' }),
    placeholderId: (0, pg_core_1.varchar)('placeholder_id', { length: 255 }).notNull(),
    concept: (0, pg_core_1.text)('concept').notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    searchQuery: (0, pg_core_1.text)('search_query'),
    status: (0, exports.visualStatusEnum)('status').default('PENDING').notNull(),
    imageUrl: (0, pg_core_1.varchar)('image_url', { length: 2048 }),
    altText: (0, pg_core_1.text)('alt_text'),
    sourceUrl: (0, pg_core_1.text)('source_url'),
    sourceTitle: (0, pg_core_1.text)('source_title'),
    errorMessage: (0, pg_core_1.text)('error_message'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.notes = (0, pg_core_1.pgTable)('notes', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    sourceId: (0, pg_core_1.integer)('source_id').notNull().references(() => exports.sources.id, { onDelete: 'cascade' }).unique(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    folderId: (0, pg_core_1.integer)('folder_id').references(() => exports.folders.id, { onDelete: 'set null' }),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    summary: (0, pg_core_1.text)('summary'),
    markdownContent: (0, pg_core_1.text)('markdown_content'),
    htmlContent: (0, pg_core_1.text)('html_content'),
    languageCode: (0, pg_core_1.varchar)('language_code', { length: 10 }),
    favorite: (0, pg_core_1.boolean)('favorite').default(false).notNull(),
    sourceType: (0, exports.sourceTypeEnum)('source_type'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// --- NEW Tags Table --- 
exports.tags = (0, pg_core_1.pgTable)('tags', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull().unique(), // Ensure tag names are unique
});
// --- NEW Notes <-> Tags Join Table --- 
exports.notesToTags = (0, pg_core_1.pgTable)('notes_tags', {
    noteId: (0, pg_core_1.integer)('note_id').notNull().references(() => exports.notes.id, { onDelete: 'cascade' }),
    tagId: (0, pg_core_1.integer)('tag_id').notNull().references(() => exports.tags.id, { onDelete: 'cascade' }),
}, 
// Define composite primary key
(t) => ({
    pk: (0, pg_core_1.primaryKey)({ columns: [t.noteId, t.tagId] }),
}));
// Add other tables (sources, notes, visuals, etc.) here later
// --- Relations --- 
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    sources: many(exports.sources),
    notes: many(exports.notes),
    folders: many(exports.folders),
}));
exports.foldersRelations = (0, drizzle_orm_1.relations)(exports.folders, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.folders.userId],
        references: [exports.users.id],
    }),
    parent: one(exports.folders, {
        fields: [exports.folders.parentId],
        references: [exports.folders.id],
        relationName: 'folderHierarchy',
    }),
    children: many(exports.folders, {
        relationName: 'folderHierarchy',
    }),
    notes: many(exports.notes),
}));
exports.sourcesRelations = (0, drizzle_orm_1.relations)(exports.sources, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.sources.userId],
        references: [exports.users.id],
    }),
    visuals: many(exports.visuals),
    note: one(exports.notes, {
        fields: [exports.sources.id],
        references: [exports.notes.sourceId]
    }),
}));
exports.visualsRelations = (0, drizzle_orm_1.relations)(exports.visuals, ({ one }) => ({
    source: one(exports.sources, {
        fields: [exports.visuals.sourceId],
        references: [exports.sources.id],
    }),
}));
exports.notesRelations = (0, drizzle_orm_1.relations)(exports.notes, ({ one, many }) => ({
    source: one(exports.sources, {
        fields: [exports.notes.sourceId],
        references: [exports.sources.id],
    }),
    user: one(exports.users, {
        fields: [exports.notes.userId],
        references: [exports.users.id],
    }),
    folder: one(exports.folders, {
        fields: [exports.notes.folderId],
        references: [exports.folders.id],
    }),
    // Add relation to join table
    notesToTags: many(exports.notesToTags),
}));
// --- ADD tagsRelations --- 
exports.tagsRelations = (0, drizzle_orm_1.relations)(exports.tags, ({ many }) => ({
    notesToTags: many(exports.notesToTags),
}));
// --- ADD notesToTagsRelations --- 
exports.notesToTagsRelations = (0, drizzle_orm_1.relations)(exports.notesToTags, ({ one }) => ({
    note: one(exports.notes, {
        fields: [exports.notesToTags.noteId],
        references: [exports.notes.id],
    }),
    tag: one(exports.tags, {
        fields: [exports.notesToTags.tagId],
        references: [exports.tags.id],
    }),
}));
