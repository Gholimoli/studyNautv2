import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '@/lib/apiClient';

// --- Types --- 
// Ideally, these would come from a shared package
interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  role: string;
  avatarUrl?: string | null;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

// --- Mutations --- 

/**
 * Mutation hook for user login.
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, LoginCredentials>({
    mutationFn: (credentials) => post<LoginCredentials, User>('/api/auth/login', credentials),
    onSuccess: (data) => {
      // Invalidate queries that depend on auth status after successful login
      console.log('Login successful:', data);
      queryClient.invalidateQueries({ queryKey: ['authStatus'] }); 
      // Optionally invalidate user profile queries etc.
    },
    onError: (error) => {
      console.error('Login failed:', error);
      // Error handling is usually done in the component using the mutation's error state
    },
  });
}

/**
 * Mutation hook for user registration.
 */
export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, RegisterCredentials>({
    mutationFn: (credentials) => post<RegisterCredentials, User>('/api/auth/register', credentials),
    onSuccess: (data) => {
      // Registration automatically logs the user in on the server,
      // so invalidate auth status query
      console.log('Registration successful:', data);
      queryClient.invalidateQueries({ queryKey: ['authStatus'] });
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    },
  });
} 