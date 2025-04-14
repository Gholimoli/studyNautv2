import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client'; // Assuming you have an configured axios/fetch instance
import { toast } from 'sonner'; // Assuming you use sonner for toasts

interface SubmitTextPayload {
  text: string;
  title?: string;
}

interface SubmitTextResponse {
  sourceId: number;
  message: string;
}

// Hook to submit text for processing
export function useSubmitTextMutation() {
  return useMutation<SubmitTextResponse, Error, SubmitTextPayload>({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/media/text', payload);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Text submitted successfully! Processing started.');
      // Optional: Invalidate queries related to sources list or navigate
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit text. Please try again.');
    },
  });
}

// --- File Upload Mutation --- //

interface UploadFilePayload {
  file: File;
  type: 'AUDIO' | 'PDF' | 'IMAGE'; // Specify allowed types based on backend
  languageCode?: string; // Optional, e.g., for audio
}

interface UploadFileResponse {
  sourceId: number;
  message: string;
}

// Hook to upload a file (audio, pdf, image)
export function useUploadFileMutation() {
  return useMutation<UploadFileResponse, Error, UploadFilePayload>({
    mutationFn: async (payload) => {
      const formData = new FormData();
      formData.append('file', payload.file);
      formData.append('type', payload.type);
      if (payload.languageCode) {
        formData.append('languageCode', payload.languageCode);
      }

      // Make sure apiClient is configured to handle FormData and content type
      const response = await apiClient.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'File uploaded successfully! Processing started.');
      // Optional: Invalidate queries related to sources list
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload file. Please try again.');
    },
  });
}

// You can add useYouTubeUrlMutation here later following the same pattern 