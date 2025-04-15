import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to ensure the user is authenticated.
 * If authenticated, continues to the next middleware/handler.
 * If not authenticated, sends a 401 Unauthorized response.
 */
export declare function ensureAuthenticated(req: Request, res: Response, next: NextFunction): void;
