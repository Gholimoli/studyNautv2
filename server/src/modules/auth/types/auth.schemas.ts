import { z } from 'zod';

export const registerUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  displayName: z.string().optional(),
});

export type RegisterUserDto = z.infer<typeof registerUserSchema>;

// Add login schema later 