declare class StorageService {
    private supabase;
    constructor();
    /**
     * Uploads a file from a local path to Supabase Storage.
     */
    uploadFile(localPath: string, storagePath: string, contentType: string): Promise<string | null>;
    /**
     * Generates a signed URL for accessing a file in Supabase Storage.
     */
    getSignedUrl(storagePath: string, expiresIn?: number): Promise<string>;
    /**
     * Deletes a file from Supabase Storage.
     */
    deleteFile(storagePath: string): Promise<boolean>;
}
export declare const storageService: StorageService;
export {};
