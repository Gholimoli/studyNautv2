"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTextSchema = void 0;
const zod_1 = require("zod");
exports.processTextSchema = zod_1.z.object({
    text: zod_1.z.string().min(10, 'Text must be at least 10 characters long'), // Basic validation
    title: zod_1.z.string().optional(), // Optional title provided by user
});
// Add schemas for file upload, youtube url later 
