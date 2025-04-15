import { z } from 'zod';
export declare const processTextSchema: z.ZodObject<{
    text: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    title?: string | undefined;
}, {
    text: string;
    title?: string | undefined;
}>;
export type ProcessTextDto = z.infer<typeof processTextSchema>;
