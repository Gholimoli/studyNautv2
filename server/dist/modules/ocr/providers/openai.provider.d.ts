interface OcrMetadata {
    originalname: string;
    mimetype: string;
}
export declare class OpenAIOcrProvider {
    providerName: string;
    process(fileBuffer: Buffer, metadata: OcrMetadata, type: 'pdf' | 'image'): Promise<{
        text: any;
        provider: string;
        meta: {
            usage: any;
        };
    }>;
}
export {};
