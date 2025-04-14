import axios from 'axios';

// Determine the base URL based on the environment
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

console.log('API Client Base URL:', baseURL);

export const apiClient = axios.create({
  baseURL: baseURL,
  withCredentials: true, // Important to send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optional: Add interceptors for error handling or token refresh if needed later
// apiClient.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     // Handle errors globally, e.g., redirect on 401
//     console.error('API call error:', error);
//     return Promise.reject(error);
//   }
// ); 