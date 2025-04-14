import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { registerUserSchema } from '../types/auth.schemas';
import passport from 'passport';

export class AuthController {

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = registerUserSchema.parse(req.body);
      
      // Call service
      const newUser = await authService.register(validatedData);
      
      // Log the user in automatically after registration
      req.logIn(newUser, (err) => {
        if (err) { 
          console.error('[AuthController Register Login Error]:', err);
          // Even if login fails, registration succeeded, so we don't throw here
          // Might want to return a specific message indicating login failed post-registration
        }
        // Send response (Created)
        const { passwordHash, ...userResponse } = newUser as any; // Temporary any
        res.status(201).json(userResponse);
      });

    } catch (error) {
      // Basic error handling for now
      // In a real app, use a centralized error handler middleware
      console.error('[AuthController Register Error]:', error);
      if (error instanceof Error) {
        // Handle validation errors (Zod) or service errors (e.g., duplicate user)
        res.status(400).json({ message: error.message }); 
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
      // next(error); // Pass to error handling middleware later
    }
  }

  // Login method using passport.authenticate
  login(req: Request, res: Response, next: NextFunction) {
    passport.authenticate('local', (err: Error | null, user: Express.User | false | null, info: { message: string } | undefined) => {
      if (err) { 
        console.error('[AuthController Login Error - Strategy]:', err);
        return res.status(500).json({ message: 'Authentication error' });
        // return next(err); 
      }
      if (!user) {
        // Authentication failed (incorrect username/password)
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }
      // Authentication successful, establish a session
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[AuthController Login Error - req.logIn]:', loginErr);
          return res.status(500).json({ message: 'Session establishment failed' });
          // return next(loginErr);
        }
        // Session established, send back user info (without password hash)
        // The user object here comes from deserializeUser, which already excludes the hash
        return res.status(200).json(user);
      });
    })(req, res, next); // Invoke the middleware returned by passport.authenticate
  }

  // Logout method
  logout(req: Request, res: Response, next: NextFunction) {
    req.logout((err) => {
      if (err) {
        console.error('[AuthController Logout Error]:', err);
        return res.status(500).json({ message: 'Logout failed' });
        // return next(err);
      }
      // Successful logout - destroy session
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('[AuthController Session Destroy Error]:', destroyErr);
          // Even if session destroy fails, logout conceptually succeeded
        }
        res.clearCookie('connect.sid'); // Ensure the session cookie is cleared
        res.status(204).send(); // Send No Content response
      });
    });
  }

  // Get authentication status
  status(req: Request, res: Response) {
    if (req.isAuthenticated()) {
      // User is authenticated, send back user data
      // req.user comes from deserializeUser and already excludes password hash
      res.status(200).json({ authenticated: true, user: req.user });
    } else {
      // User is not authenticated
      res.status(200).json({ authenticated: false, user: null });
    }
  }
}

export const authController = new AuthController(); 