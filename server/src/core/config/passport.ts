import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { db } from '@/core/db';
import { users } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

// Define user type based on schema (excluding passwordHash)
type User = Omit<typeof users.$inferSelect, 'passwordHash'>;

export function configurePassport() {
  // Local Strategy for username/password login
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        // Find user by username
        const userRecord = await db.query.users.findFirst({
          where: eq(users.username, username),
        });

        if (!userRecord) {
          return done(null, false, { message: 'Incorrect username.' });
        }

        // Compare password hash
        const isMatch = await bcrypt.compare(password, userRecord.passwordHash);

        if (!isMatch) {
          return done(null, false, { message: 'Incorrect password.' });
        }

        // Successful login - return user data (excluding password)
        const { passwordHash, ...user } = userRecord;
        return done(null, user as User);
      } catch (err) {
        return done(err);
      }
    }
  ));

  // Serialize user ID into the session
  passport.serializeUser((user, done) => {
    process.nextTick(() => {
       done(null, (user as User).id); 
    });
  });

  // Deserialize user from the session using the ID
  passport.deserializeUser(async (id: number, done) => {
    try {
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: { // Explicitly exclude passwordHash
            passwordHash: false
        }
      });
      if (!userRecord) {
        return done(new Error('User not found'));
      }
      done(null, userRecord as User);
    } catch (err) {
      done(err);
    }
  });

  console.log('[Passport] Configured successfully.');
} 