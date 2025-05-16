export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Implement backoff strategy
      const retryDelay = delay * Math.pow(2, i);
      
      // Use process.stdout.write instead of console.log for Node environments
      process.stdout.write(`Attempt ${i + 1} failed. Retrying in ${retryDelay}ms\n`);
      lastError = error as Error;
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

export function handleApiError(error: any, operation: string): Error {
  // Log error details
  process.stderr.write(`Error in ${operation}: ${JSON.stringify(error)}\n`);
  
  // Handle different types of errors
  if (error.response) {
    // The request was made and the server responded with an error status
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 401 || status === 403) {
      return new Error(`Authentication error: ${data?.message || 'Invalid credentials'}`);
    } else if (status === 429) {
      return new Error(`Rate limit exceeded: ${data?.message || 'Too many requests'}`);
    } else {
      return new Error(`API error (${status}): ${data?.message || error.message}`);
    }
  } else if (error.request) {
    // The request was made but no response was received
    return new Error(`No response from server: ${error.message}`);
  } else {
    // Something happened in setting up the request
    return new Error(`Request setup error: ${error.message}`);
  }
} 