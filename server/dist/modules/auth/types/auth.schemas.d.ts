import { z } from 'zod';
export declare const registerUserSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username: string;
    email: string;
    password: string;
    displayName?: string | undefined;
}, {
    username: string;
    email: string;
    password: string;
    displayName?: string | undefined;
}>;
export type RegisterUserDto = z.infer<typeof registerUserSchema>;
