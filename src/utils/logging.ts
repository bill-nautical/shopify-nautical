import type { ActionContext } from "@prismatic-io/spectral";

/**
 * Log information message using Prismatic's logger
 * @param context The action context containing the logger
 * @param message The message to log
 * @param data Additional data to include in the log
 */
export function logInfo(
  context: ActionContext,
  message: string,
  data: Record<string, unknown> = {},
): void {
  context.logger.info(message, data);
}

/**
 * Log error message using Prismatic's logger
 * @param context The action context containing the logger
 * @param message The message to log
 * @param error The error object
 */
export function logError(
  context: ActionContext,
  message: string,
  error: Error,
): void {
  context.logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...error,
  });
}

/**
 * Log warning message using Prismatic's logger
 * @param context The action context containing the logger
 * @param message The message to log
 * @param data Additional data to include in the log
 */
export function logWarning(
  context: ActionContext,
  message: string,
  data: Record<string, unknown> = {},
): void {
  context.logger.warn(message, data);
}

/**
 * Log debug message using Prismatic's logger
 * @param context The action context containing the logger
 * @param message The message to log
 * @param data Additional data to include in the log
 */
export function logDebug(
  context: ActionContext,
  message: string,
  data: Record<string, unknown> = {},
): void {
  context.logger.debug(message, data);
}

/**
 * Log metric using Prismatic's logger
 * @param context The action context containing the logger
 * @param metricName The name of the metric
 * @param value The numeric value of the metric
 * @param tags Tags to associate with the metric
 */
export function logMetric(
  context: ActionContext,
  metricName: string,
  value: number,
  tags: Record<string, unknown> = {},
): void {
  context.logger.metric(metricName, value, tags);
}
