import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name cannot be empty').max(100, 'Folder name too long'),
  parentId: z.number().int().positive().optional().nullable(), // Optional: ID of the parent folder for nesting
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>; 

export const updateFolderSchema = z.object({
    name: z.string().min(1, 'Folder name cannot be empty').max(100, 'Folder name too long').optional(),
    parentId: z.number().int().positive().optional().nullable(), // Allow moving to top-level (null) or another folder
}).refine(data => data.name !== undefined || data.parentId !== undefined, {
    message: 'At least one field (name or parentId) must be provided for update',
});

export type UpdateFolderInput = z.infer<typeof updateFolderSchema>; 