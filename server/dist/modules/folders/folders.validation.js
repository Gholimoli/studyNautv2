"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFolderSchema = exports.createFolderSchema = void 0;
const zod_1 = require("zod");
exports.createFolderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Folder name cannot be empty').max(100, 'Folder name too long'),
    parentId: zod_1.z.number().int().positive().optional().nullable(), // Optional: ID of the parent folder for nesting
});
exports.updateFolderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Folder name cannot be empty').max(100, 'Folder name too long').optional(),
    parentId: zod_1.z.number().int().positive().optional().nullable(), // Allow moving to top-level (null) or another folder
}).refine(data => data.name !== undefined || data.parentId !== undefined, {
    message: 'At least one field (name or parentId) must be provided for update',
});
