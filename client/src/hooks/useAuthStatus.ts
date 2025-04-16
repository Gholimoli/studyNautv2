import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Define the expected shape of the /api/auth/status response
interface AuthStatus {
    authenticated: boolean;
    user: {
        id: number;
        username: string;
        email: string;
        role: string;
        displayName?: string | null;
        avatarUrl?: string | null;
    } | null;
}

// API function to fetch auth status
export const fetchAuthStatus = async (): Promise<AuthStatus> => {
    const response = await apiClient.get<AuthStatus>('/auth/status');
    return response.data; // Return response.data for Axios
};

// Hook to get the current authentication status
export function useAuthStatus() {
    return useQuery<AuthStatus, Error>({
        queryKey: ['authStatus'], // Cache key
        queryFn: fetchAuthStatus,
        staleTime: 5 * 60 * 1000, // Don't refetch status too often (e.g., 5 mins)
        retry: 1, // Retry once on error
        // Tweak options as needed for error handling/refetching
    });
} 