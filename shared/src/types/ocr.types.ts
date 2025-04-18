export interface OcrResult {
  text: string;
  provider: string;
  meta?: any; // Optional metadata
}

// IOcrProvider interface remains server-side due to Node.js Buffer type 