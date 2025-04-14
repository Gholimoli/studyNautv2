"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notesRelations = exports.visualsRelations = exports.sourcesRelations = exports.usersRelations = exports.notes = exports.visuals = exports.sources = exports.users = exports.visualStatusEnum = exports.processingStatusEnum = exports.sourceTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// --- Enums --- 
exports.sourceTypeEnum = (0, pg_core_1.pgEnum)('source_type', ['YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE']);
exports.processingStatusEnum = (0, pg_core_1.pgEnum)('processing_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
exports.visualStatusEnum = (0, pg_core_1.pgEnum)('visual_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
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
exports.sources = (0, pg_core_1.pgTable)('sources', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    sourceType: (0, exports.sourceTypeEnum)('source_type').notNull(),
    originalUrl: (0, pg_core_1.varchar)('original_url', { length: 2048 }),
    originalFilename: (0, pg_core_1.varchar)('original_filename', { length: 255 }),
    extractedText: (0, pg_core_1.text)('extracted_text'),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    processingStatus: (0, exports.processingStatusEnum)('processing_status').default('PENDING').notNull(),
    processingStage: (0, pg_core_1.varchar)('processing_stage', { length: 100 }),
    processingError: (0, pg_core_1.text)('processing_error'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.visuals = (0, pg_core_1.pgTable)('visuals', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    sourceId: (0, pg_core_1.integer)('source_id').notNull().references(() => exports.sources.id, { onDelete: 'cascade' }),
    placeholderId: (0, pg_core_1.varchar)('placeholder_id', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    searchQuery: (0, pg_core_1.text)('search_query'),
    status: (0, exports.visualStatusEnum)('status').default('PENDING').notNull(),
    imageUrl: (0, pg_core_1.varchar)('image_url', { length: 2048 }),
    errorMessage: (0, pg_core_1.text)('error_message'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.notes = (0, pg_core_1.pgTable)('notes', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    sourceId: (0, pg_core_1.integer)('source_id').notNull().references(() => exports.sources.id, { onDelete: 'cascade' }).unique(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    sourceType: (0, exports.sourceTypeEnum)('source_type').notNull(),
    markdownContent: (0, pg_core_1.text)('markdown_content'),
    htmlContent: (0, pg_core_1.text)('html_content'),
    favorite: (0, pg_core_1.boolean)('favorite').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// Add other tables (sources, notes, visuals, etc.) here later
// --- Relations --- 
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    sources: many(exports.sources),
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
exports.notesRelations = (0, drizzle_orm_1.relations)(exports.notes, ({ one }) => ({
    source: one(exports.sources, {
        fields: [exports.notes.sourceId],
        references: [exports.sources.id],
    }),
    user: one(exports.users, {
        fields: [exports.notes.userId],
        references: [exports.users.id],
    }),
}));
