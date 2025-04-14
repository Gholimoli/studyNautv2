"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAuthenticated = ensureAuthenticated;
/**
 * Middleware to ensure the user is authenticated.
 * If authenticated, continues to the next middleware/handler.
 * If not authenticated, sends a 401 Unauthorized response.
 */
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
}
// Potential future middleware: check specific roles
// export function ensureRole(role: string) {
//   return (req: Request, res: Response, next: NextFunction) => {
//     if (req.isAuthenticated() && req.user && (req.user as any).role === role) {
//       return next();
//     }
//     res.status(403).json({ message: 'Forbidden' });
//   };
// } 
