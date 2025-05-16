import { logError } from "./logging";
import type { ActionContext } from "@prismatic-io/spectral";

/**
 * Execute a function with retry logic
 * @param fn The async function to execute and retry if it fails
 * @param maxRetries Maximum number of retry attempts
 * @param delay Initial delay in milliseconds between retries (will be increased with exponential backoff)
 * @param context Optional action context for logging
 * @returns Promise resolving to the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
  context?: ActionContext,
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Implement backoff strategy
      const retryDelay = delay * 2 ** i;
      const errorObject =
        error instanceof Error ? error : new Error(String(error));

      // Log using Prismatic logger if context is provided
      if (context) {
        logError(
          context,
          `Attempt ${i + 1} failed. Retrying in ${retryDelay}ms`,
          errorObject,
        );
      } else {
        // Fallback to process.stdout.write
        process.stdout.write(
          `Attempt ${i + 1} failed. Retrying in ${retryDelay}ms\n`,
        );
      }

      lastError = errorObject;

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Properly handle and format API errors
 * @param error The error object caught in a try/catch
 * @param operation Description of the operation that failed
 * @param context Optional action context for logging
 * @returns A formatted Error object
 */
export function handleApiError(
  error: unknown,
  operation: string,
  context?: ActionContext,
): Error {
  // Cast the error to a specific type for better handling
  const apiError = error as {
    response?: {
      status: number;
      data?: { message?: string };
    };
    request?: unknown;
    message?: string;
  };

  let formattedError: Error;

  // Handle different types of errors
  if (apiError.response) {
    // The request was made and the server responded with an error status
    const status = apiError.response.status;
    const data = apiError.response.data;

    if (status === 401 || status === 403) {
      formattedError = new Error(
        `Authentication error: ${data?.message || "Invalid credentials"}`,
      );
    } else if (status === 429) {
      formattedError = new Error(
        `Rate limit exceeded: ${data?.message || "Too many requests"}`,
      );
    } else {
      formattedError = new Error(
        `API error (${status}): ${data?.message || apiError.message || "Unknown error"}`,
      );
    }
  } else if (apiError.request) {
    // The request was made but no response was received
    formattedError = new Error(
      `No response from server: ${apiError.message || "Connection failed"}`,
    );
  } else {
    // Something happened in setting up the request
    formattedError = new Error(
      `Request setup error: ${apiError.message || "Unknown error"}`,
    );
  }

  // Log error if context is provided
  if (context) {
    logError(context, `Error in ${operation}`, formattedError);
  } else {
    // Fallback to process.stderr.write
    process.stderr.write(`Error in ${operation}: ${formattedError.message}\n`);
  }

  return formattedError;
}
