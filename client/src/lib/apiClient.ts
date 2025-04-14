// Basic fetch-based API client

/**
 * Performs a POST request to the API.
 * Automatically handles JSON stringification and content type.
 * Assumes API base path is handled by Vite proxy.
 */
export async function post<T = any, R = any>(path: string, data: T): Promise<R> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Credentials needed for session cookies
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
    //credentials: 'include', // Send cookies with the request
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If response is not JSON
      errorData = { message: response.statusText };
    }
    // Throw an error object compatible with TanStack Query's error handling
    const error = new Error(errorData?.message || 'API request failed') as any;
    error.response = response; 
    error.data = errorData;
    throw error;
  }

  // Handle No Content response (e.g., for logout)
  if (response.status === 204) {
    return undefined as R;
  }

  return response.json() as Promise<R>;
}

/**
 * Performs a GET request to the API.
 */
export async function get<R = any>(path: string): Promise<R> {
  const response = await fetch(path, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    //credentials: 'include', // Send cookies with the request
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: response.statusText };
    }
    const error = new Error(errorData?.message || 'API request failed') as any;
    error.response = response;
    error.data = errorData;
    throw error;
  }
  return response.json() as Promise<R>;
}

// Add PUT, DELETE methods if needed later 