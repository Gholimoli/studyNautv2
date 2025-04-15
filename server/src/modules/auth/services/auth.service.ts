import { db } from '../../../core/db/index';
import { users } from '../../../core/db/schema';
import { RegisterUserDto } from '../types/auth.schemas';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10; // Define salt rounds

export class AuthService {
  
  // NOTE: This is a placeholder. Password hashing and proper error handling will be added later.
  async register(userData: RegisterUserDto) {
    console.log('[AuthService] Registering user:', userData.username);

    // 1. Check if user already exists (by username or email)
    const existingUser = await db.query.users.findFirst({
      where: (users, { or, eq }) => 
        or(
          eq(users.username, userData.username),
          eq(users.email, userData.email)
        ),
    });

    if (existingUser) {
        if (existingUser.username === userData.username) {
            throw new Error('Username already exists'); // Use custom error classes later
        }
        if (existingUser.email === userData.email) {
            throw new Error('Email already exists'); // Use custom error classes later
        }
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

    // 3. Insert user into database
    const newUserResult = await db.insert(users).values({
      username: userData.username,
      email: userData.email,
      passwordHash: hashedPassword, 
      displayName: userData.displayName,
      // role, createdAt, updatedAt have defaults
    }).returning({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        role: users.role
    });
    
    if (!newUserResult || newUserResult.length === 0) {
        throw new Error('Failed to create user');
    }

    const newUser = newUserResult[0];
    console.log('[AuthService] User registered successfully:', newUser.username);
    
    // 4. Return the created user data (excluding password)
    return newUser;
  }

  // Add login, logout methods later
}

export const authService = new AuthService(); 