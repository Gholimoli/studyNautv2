import { ProcessTextDto } from '../types/media.schemas';
interface AuthenticatedUser {
    id: number;
}
interface UploadedFile {
    path: string;
    originalname: string;
    mimetype: string;
}
export declare class MediaService {
    createSourceFromText(data: ProcessTextDto, user: AuthenticatedUser): Promise<{
        sourceId: number;
        message: string;
    }>;
    /**
     * Handles processing of an uploaded audio file.
     * Uploads to Supabase, creates source record, and queues transcription job.
     * @param file The uploaded file object (containing path, originalname, mimetype).
     * @param user The authenticated user.
     * @param languageCode Optional language code for transcription.
     * @returns The result containing the new source ID.
     */
    createSourceFromAudioUpload(file: UploadedFile, user: AuthenticatedUser, languageCode?: string): Promise<{
        sourceId: number;
        message: string;
    }>;
}
export declare const mediaService: MediaService;
export {};
