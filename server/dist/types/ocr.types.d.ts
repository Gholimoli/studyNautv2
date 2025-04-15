export interface OcrResult {
    text: string;
    provider: string;
    meta?: any;
}
export interface IOcrProvider {
    providerName: string;
    process(fileBuffer: Buffer, metadata: {
        originalname: string;
        mimetype: string;
    }, type: 'pdf' | 'image'): Promise<OcrResult | null>;
}
