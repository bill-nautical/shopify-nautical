# AI Coding Guidelines for Shopify-Nautical Integration

This document outlines best practices for using AI tools (like Cursor) with this Prismatic integration project.

## General Prismatic Patterns

When developing with AI assistance, ensure the generated code follows these Prismatic-specific patterns:

### Logging

- Always use Prismatic's logger rather than `console.log`
- Use the appropriate log level: `debug`, `info`, `warn`, or `error`
- Include structured data with logs where helpful
- Example: `context.logger.info("Fetching products from Shopify", { count: products.length })`

### Error Handling

- Use try/catch blocks for all async operations
- Provide meaningful error messages that include operation context
- Use our `withRetry` and `handleApiError` utilities for resilient operations
- Always log errors using `logError` utility with sufficient context

### API Interactions

- Use the established client patterns in `src/client.ts`
- Extract configuration from inputs, never hardcode API URLs or credentials
- Include proper error handling for all API calls
- Follow the withRetry pattern for operations that may be subject to rate limiting

### Function Structure

- Use clear, descriptive function names that follow camelCase convention
- Document functions with JSDoc comments
- Avoid unnecessary async wrappers or IIFEs
- Keep functions focused on a single responsibility

## Using AI Tools for Development

When using Cursor or other AI tools to develop this integration:

1. Reference the `.spectral.yaml` file to ensure AI follows our conventions
2. Use these prompt patterns for best results:

   - "Help me create a [component] that follows the pattern in [existing file]"
   - "Refactor this code to use our error handling utilities"

3. Always review AI-generated code for these common issues:
   - Hardcoded values that should come from configurations
   - Missing error handling
   - Incomplete logging
   - Non-standard patterns

## Example Prompts

```
// Creating a new action
Help me create a new action in src/flows/productImport.ts that synchronizes product inventory between Shopify and Nautical following our established patterns

// Fixing error handling
Refactor this function to use our withRetry utility and proper error logging

// Adding a new API integration
Help me implement a function to fetch order data from Shopify following our API client patterns
```

Remember that all AI-generated code should be reviewed and tested before deployment.
