import { Request, Response, NextFunction } from 'express';
export declare class AuthController {
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    login(req: Request, res: Response, next: NextFunction): void;
    logout(req: Request, res: Response, next: NextFunction): void;
    status(req: Request, res: Response): void;
}
export declare const authController: AuthController;
