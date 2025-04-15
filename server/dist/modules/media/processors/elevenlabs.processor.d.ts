import { TranscriptData } from '@shared/types/transcript.types';
export declare function processAudioWithElevenLabs(audioFilePath: string, languageCode?: string): Promise<TranscriptData | null>;
