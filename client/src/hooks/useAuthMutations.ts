import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client'; // Assuming axios client is exported from here
import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';

// Re-define or import Zod schemas if not shared
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
type LoginFormInputs = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
  // Add confirmPassword if needed by API, otherwise it's frontend only
});
type RegisterFormInputs = z.infer<typeof registerSchema>;

// Define expected User response type (adjust based on your actual API response)
interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    // add other fields returned by login/register
}

// --- API Call Functions --- //

const loginUser = async (credentials: LoginFormInputs): Promise<User> => {
    console.log('[loginUser] Attempting API Call to /api/auth/login with credentials:', credentials);
    try {
        const response = await apiClient.post<LoginFormInputs, User>('/auth/login', credentials);
        console.log('[loginUser] API Call SUCCESS:', response);
        return response; // Axios returns response.data directly on success >= 200 < 300
    } catch (error) {
        console.error('[loginUser] API Call FAILED:', error);
        throw error; // Re-throw the error to be caught by useMutation's onError
    }
};

const registerUser = async (userData: RegisterFormInputs): Promise<User> => {
    console.log('API Call: /api/auth/register', userData);
    // Ensure you only send fields expected by the backend API (e.g., exclude confirmPassword if needed)
    const response = await apiClient.post<RegisterFormInputs, User>('/auth/register', userData);
    return response; // Axios automatically returns the data for successful responses
};

const logoutUser = async (): Promise<void> => {
    console.log('API Call: /api/auth/logout');
    // Logout likely doesn't return user data, just confirms success
    await apiClient.post('/auth/logout'); 
    // No explicit return needed for void
};

// --- Mutation Hooks --- //

export function useLoginMutation() {
    const queryClient = useQueryClient();
    // const navigate = useNavigate(); // Remove navigate from here

    return useMutation<User, Error, LoginFormInputs>({
        mutationFn: loginUser,
        onSuccess: (data) => { // No longer async
            console.log('Login successful (hook):', data);
            // Only invalidate queries here
            queryClient.invalidateQueries({ queryKey: ['authStatus'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile'] }); 
        },
        onError: (error) => {
             console.error('Login error (hook):', error);
        }
    });
}

export function useRegisterMutation() {
     const queryClient = useQueryClient();

    return useMutation<User, Error, RegisterFormInputs>({
        mutationFn: registerUser,
         onSuccess: (data) => {
            console.log('Registration successful:', data);
             // Invalidate queries that depend on auth state
            queryClient.invalidateQueries({ queryKey: ['authStatus'] }); 
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            // TODO: Navigate to dashboard or maybe show a "check email" message
            // TODO: Show success toast
        },
        onError: (error) => {
             console.error('Registration error:', error);
            // TODO: Show error toast with specific message if available (e.g., username taken)
        }
    });
}

export function useLogoutMutation() {
    const queryClient = useQueryClient();
    const navigate = useNavigate(); // Import useNavigate

    return useMutation<void, Error, void>({
        mutationFn: logoutUser,
         onSuccess: () => {
            console.log('Logout successful');
             // Clear user data and redirect
            queryClient.invalidateQueries({ queryKey: ['authStatus'] }); 
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            // Remove all queries to be safe upon logout
            queryClient.removeQueries(); 
            navigate({ to: '/login', replace: true }); // Navigate to login page
            // Optional: Show logout success toast
        },
        onError: (error) => {
             console.error('Logout error:', error);
            // Optional: Show logout error toast
            // Even on error, attempt to redirect to login
            if (!window.location.pathname.startsWith('/login')) {
                navigate({ to: '/login', replace: true });
            }
        }
    });
} 