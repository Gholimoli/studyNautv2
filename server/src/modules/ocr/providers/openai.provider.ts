import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_OCR_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

interface OcrMetadata {
  originalname: string;
  mimetype: string;
}

export class OpenAIOcrProvider {
  providerName = 'openai';

  async process(fileBuffer: Buffer, metadata: OcrMetadata, type: 'pdf' | 'image') {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set');
    }

    console.log(`[OpenAIOcrProvider] Processing buffer for: ${metadata.originalname}`);
    const base64 = fileBuffer.toString('base64');
    const mimeType = type === 'pdf' ? 'application/pdf' : metadata.mimetype;

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all readable text from this document.' },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ],
      },
    ];

    const res = await fetch(OPENAI_OCR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 4096,
      }),
    });

    const resText = await res.text();
    console.log(`[OpenAIOcrProvider] Response status: ${res.status}`);
    console.log(`[OpenAIOcrProvider] Response text: ${resText.substring(0, 500)}...`);

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error(`[OpenAIOcrProvider] API error 401: Invalid OpenAI API Key.`);
      }
      if (res.status === 429) {
        throw new Error(`[OpenAIOcrProvider] API error 429: OpenAI Rate Limit Exceeded.`);
      }
      throw new Error(`[OpenAIOcrProvider] API error: ${res.status} ${resText}`);
    }

    let data: any;
    try {
        data = JSON.parse(resText);
    } catch (parseError) {
        console.error("[OpenAIOcrProvider] Raw response text on parse failure:", resText);
        throw new Error(`[OpenAIOcrProvider] Failed to parse OpenAI JSON response: ${parseError}`);
    }

    const text = data.choices?.[0]?.message?.content || '';
    console.log(`[OpenAIOcrProvider] Successfully processed. Extracted ${text.length} characters.`);

    return {
      text,
      provider: this.providerName,
      meta: { usage: data.usage },
    };
  }
} 