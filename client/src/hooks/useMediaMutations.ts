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