import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { db } from '../db/index';
import { users } from '../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

// Define User type structure based on your schema
interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  // Add other fields as needed (displayName, role, etc.)
}

export function configurePassport() {
  // Local strategy for username/password login
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        console.log(`[Passport] Attempting login for username: ${username}`);
        // Find user by username or email
        const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
        const user = result[0] as User | undefined;

        if (!user) {
          console.log(`[Passport] User not found: ${username}`);
          return done(null, false, { message: 'Incorrect username or password.' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          console.log(`[Passport] Incorrect password for user: ${username}`);
          return done(null, false, { message: 'Incorrect username or password.' });
        }

        console.log(`[Passport] Login successful for user: ${username}, ID: ${user.id}`);
        return done(null, user);
      } catch (err) {
        console.error('[Passport] Error during authentication:', err);
        return done(err);
      }
    }
  ));

  // Serialize user ID into the session
  passport.serializeUser((user: any, done) => {
    // console.log('[Passport] Serializing user:', user);
    done(null, (user as User).id);
  });

  // Deserialize user from the session using the ID
  passport.deserializeUser(async (id: number, done) => {
    try {
      // console.log(`[Passport] Deserializing user with ID: ${id}`);
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      const user = result[0] as User | undefined;
      // console.log('[Passport] Deserialized user found:', user);
      done(null, user || null); // Pass null if user not found
    } catch (err) {
      console.error(`[Passport] Error during deserialization for ID: ${id}`, err);
      done(err);
    }
  });

  console.log('[Passport] Passport configured.');
} 