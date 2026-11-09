import { pipeline } from '@xenova/transformers';

class WhisperService {
  private static instance: WhisperService;
  private pipeline: any = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): WhisperService {
    if (!WhisperService.instance) {
      WhisperService.instance = new WhisperService();
    }
    return WhisperService.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('Loading Whisper model...');
      this.pipeline = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny'
      );
      this.isInitialized = true;
      console.log('Whisper model loaded successfully');
    } catch (error) {
      console.error('Failed to load Whisper model:', error);
      this.isInitialized = false;
    }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    if (!this.isInitialized || !this.pipeline) {
      throw new Error('Whisper not initialized');
    }

    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const result = await this.pipeline(audioUrl, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'english',
        task: 'transcribe',
      });

      URL.revokeObjectURL(audioUrl);
      return result?.text || '';
    } catch (error) {
      console.error('Transcription failed:', error);
      throw new Error('Transcription failed');
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const whisperService = WhisperService.getInstance();