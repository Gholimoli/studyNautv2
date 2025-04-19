"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config/config"); // Fixed import path
const fs = __importStar(require("fs/promises"));
const BUCKET_NAME = 'originalaudio'; // Corrected bucket name (no underscores)
class StorageService {
    constructor() {
        if (!config_1.config.supabase.url || !config_1.config.supabase.serviceKey) {
            throw new Error('Supabase URL and Service Key must be configured in environment variables.');
        }
        this.supabase = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.serviceKey, {
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
    uploadFile(localPath, storagePath, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`[StorageService] Uploading ${localPath} to Supabase at ${BUCKET_NAME}/${storagePath}`);
                const fileBuffer = yield fs.readFile(localPath);
                const { data, error } = yield this.supabase.storage
                    .from(BUCKET_NAME)
                    .upload(storagePath, fileBuffer, {
                    contentType,
                    upsert: true,
                });
                if (error) {
                    console.error(`[StorageService] Supabase upload error for ${storagePath}:`, error);
                    throw new Error(`Supabase upload failed: ${error.message}`);
                }
                console.log(`[StorageService] Successfully uploaded to ${data === null || data === void 0 ? void 0 : data.path}`);
                return storagePath;
            }
            catch (error) {
                console.error(`[StorageService] Error during file upload process for ${localPath}:`, error);
                throw error;
            }
        });
    }
    /**
     * Generates a signed URL for accessing a file in Supabase Storage.
     */
    getSignedUrl(storagePath_1) {
        return __awaiter(this, arguments, void 0, function* (storagePath, expiresIn = 3600) {
            try {
                console.log(`[StorageService] Generating signed URL for ${BUCKET_NAME}/${storagePath}`);
                const { data, error } = yield this.supabase.storage
                    .from(BUCKET_NAME)
                    .createSignedUrl(storagePath, expiresIn);
                if (error) {
                    console.error(`[StorageService] Supabase signed URL error for ${storagePath}:`, error);
                    throw new Error(`Failed to create signed URL: ${error.message}`);
                }
                if (!(data === null || data === void 0 ? void 0 : data.signedUrl)) {
                    throw new Error('Supabase did not return a signed URL.');
                }
                return data.signedUrl;
            }
            catch (error) {
                console.error(`[StorageService] Error generating signed URL for ${storagePath}:`, error);
                throw error;
            }
        });
    }
    /**
     * Deletes a file from Supabase Storage.
     */
    deleteFile(storagePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`[StorageService] Deleting file from Supabase at ${BUCKET_NAME}/${storagePath}`);
                const { error } = yield this.supabase.storage
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
            }
            catch (error) {
                console.error(`[StorageService] Error during file deletion process for ${storagePath}:`, error);
                return false;
            }
        });
    }
    /**
     * Downloads a file from Supabase Storage to a local path.
     */
    downloadFile(storagePath, localPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`[StorageService] Downloading ${BUCKET_NAME}/${storagePath} to ${localPath}`);
                const { data, error } = yield this.supabase.storage
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
                const buffer = Buffer.from(yield data.arrayBuffer());
                yield fs.writeFile(localPath, buffer);
                console.log(`[StorageService] Successfully downloaded file to ${localPath}`);
            }
            catch (error) {
                console.error(`[StorageService] Error during file download process for ${storagePath}:`, error);
                // Clean up partially downloaded file if it exists
                try {
                    yield fs.unlink(localPath);
                }
                catch (e) { /* ignore */ }
                throw error; // Re-throw the error
            }
        });
    }
}
exports.storageService = new StorageService();
