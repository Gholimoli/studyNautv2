import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/config'; // Fixed import path
import * as fs from 'fs/promises';

const BUCKET_NAME = 'originalaudio'; // Corrected bucket name (no underscores)

class StorageService {
  private supabase: SupabaseClient;

  constructor() {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('Supabase URL and Service Key must be configured in environment variables.');
    }
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });
    console.log('[StorageService] Supabase client initialized.');
  }

  /**
   * Uploads a file from a local path to Supabase Storage.
   */
  async uploadFile(localPath: string, storagePath: string, contentType: string): Promise<string | null> {
    try {
      console.log(`[StorageService] Uploading ${localPath} to Supabase at ${BUCKET_NAME}/${storagePath}`);
      const fileBuffer = await fs.readFile(localPath);
      const { data, error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true,
        });
      if (error) {
        console.error(`[StorageService] Supabase upload error for ${storagePath}:`, error);
        throw new Error(`Supabase upload failed: ${error.message}`);
      }
      console.log(`[StorageService] Successfully uploaded to ${data?.path}`);
      return storagePath;
    } catch (error) {
      console.error(`[StorageService] Error during file upload process for ${localPath}:`, error);
      throw error;
    }
  }

  /**
   * Generates a signed URL for accessing a file in Supabase Storage.
   */
  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      console.log(`[StorageService] Generating signed URL for ${BUCKET_NAME}/${storagePath}`);
      const { data, error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, expiresIn);
      if (error) {
        console.error(`[StorageService] Supabase signed URL error for ${storagePath}:`, error);
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }
      if (!data?.signedUrl) {
        throw new Error('Supabase did not return a signed URL.');
      }
      return data.signedUrl;
    } catch (error) {
      console.error(`[StorageService] Error generating signed URL for ${storagePath}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a file from Supabase Storage.
   */
  async deleteFile(storagePath: string): Promise<boolean> {
    try {
      console.log(`[StorageService] Deleting file from Supabase at ${BUCKET_NAME}/${storagePath}`);
      const { error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);
      if (error) {
        if (error.message.includes('Not found')) {
          console.warn(`[StorageService] File not found during delete attempt (considered success): ${storagePath}`);
          return true;
        }
        console.error(`[StorageService] Supabase delete error for ${storagePath}:`, error);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`[StorageService] Error during file deletion process for ${storagePath}:`, error);
      return false;
    }
  }

  /**
   * Downloads a file from Supabase Storage to a local path.
   */
  async downloadFile(storagePath: string, localPath: string): Promise<void> {
    try {
      console.log(`[StorageService] Downloading ${BUCKET_NAME}/${storagePath} to ${localPath}`);
      const { data, error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .download(storagePath);

      if (error) {
        console.error(`[StorageService] Supabase download error for ${storagePath}:`, error);
        throw new Error(`Supabase download failed: ${error.message}`);
      }

      if (!data) {
        throw new Error('Supabase did not return file data.');
      }

      // Convert Blob/ArrayBuffer to Buffer for Node.js fs
      const buffer = Buffer.from(await data.arrayBuffer()); 
      await fs.writeFile(localPath, buffer);
      console.log(`[StorageService] Successfully downloaded file to ${localPath}`);

    } catch (error) {
      console.error(`[StorageService] Error during file download process for ${storagePath}:`, error);
      // Clean up partially downloaded file if it exists
      try { await fs.unlink(localPath); } catch (e) { /* ignore */ }
      throw error; // Re-throw the error
    }
  }
}

export const storageService = new StorageService(); 