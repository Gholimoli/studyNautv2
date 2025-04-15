export interface OCRResult {
    text: string;
    provider: string;
    meta?: any;
}
declare class OcrService {
    private providers;
    constructor();
    processFile(file: Express.Multer.File, type: 'pdf' | 'image'): Promise<OCRResult>;
    private cleanupTempFile;
}
export declare const ocrService: OcrService;
export {};
