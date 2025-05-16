export function logInfo(context: any, message: string, data: Record<string, any> = {}) {
  context.logger.info(message, data);
}

export function logError(context: any, message: string, error: Error) {
  context.logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...error
  });
}

export function logWarning(context: any, message: string, data: Record<string, any> = {}) {
  context.logger.warn(message, data);
}

export function logMetric(context: any, metricName: string, value: number, tags: Record<string, any> = {}) {
  context.logger.metric(metricName, value, tags);
} 