import type { OcrResult } from '@shared/types/ocr.types';

export interface IOcrProvider {
  providerName: string;
  process(
    fileBuffer: Buffer,
    metadata: { originalname: string; mimetype: string },
    type: 'pdf' | 'image'
  ): Promise<OcrResult | null>;
} 