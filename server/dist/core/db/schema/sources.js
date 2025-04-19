"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourcesRelations = exports.sources = exports.processingStatusEnum = exports.sourceTypeEnum = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const schema_1 = require("../schema");
exports.sourceTypeEnum = (0, pg_core_1.pgEnum)('source_type', ['YOUTUBE', 'TEXT', 'AUDIO', 'PDF', 'IMAGE']);
exports.processingStatusEnum = (0, pg_core_1.pgEnum)('processing_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
exports.sources = (0, pg_core_1.pgTable)('sources', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id')
        .notNull()
        .references(() => schema_1.users.id, { onDelete: 'cascade' }),
    sourceType: (0, exports.sourceTypeEnum)('source_type').notNull(),
    originalUrl: (0, pg_core_1.text)('original_url'),
    originalFilename: (0, pg_core_1.text)('original_filename'),
    originalStoragePath: (0, pg_core_1.text)('original_storage_path'), // New column for Supabase path
    processingStatus: (0, exports.processingStatusEnum)('processing_status').default('PENDING').notNull(),
    processingStage: (0, pg_core_1.text)('processing_stage').default('WAITING_FOR_TRANSCRIPTION'), // e.g., 'TRANSCRIBING', 'ANALYZING', 'GENERATING_VISUALS'
    processingError: (0, pg_core_1.text)('processing_error'),
    extractedText: (0, pg_core_1.text)('extracted_text'), // Store extracted text/transcript here
    metadata: (0, pg_core_1.json)('metadata'), // Store things like video title, duration, language, etc.
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.sourcesRelations = (0, drizzle_orm_1.relations)(exports.sources, ({ one, many }) => ({
    user: one(schema_1.users, {
        fields: [exports.sources.userId],
        references: [schema_1.users.id],
    }),
    note: one(schema_1.notes, {
        fields: [exports.sources.id],
        references: [schema_1.notes.sourceId],
    }),
    visuals: many(schema_1.visuals), // A source can have multiple visual elements
}));
