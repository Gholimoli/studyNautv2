import { IOcrProvider, OcrResult } from '@/types/ocr.types';
export declare class MistralOcrProvider implements IOcrProvider {
    readonly providerName = "mistral";
    private apiKey;
    private baseUrl;
    constructor();
    process(fileBuffer: Buffer, metadata: {
        originalname: string;
        mimetype: string;
    }, type: 'pdf' | 'image'): Promise<OcrResult | null>;
    private processPdf;
    private processImageBase64;
    private uploadFile;
    private getSignedUrl;
    private deleteFile;
    private formatResult;
}
