import { Request, Response, NextFunction } from 'express';
export declare class MediaController {
    processText(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Handles audio file upload requests.
     */
    uploadAudio(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const mediaController: MediaController;
