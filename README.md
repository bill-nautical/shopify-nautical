# Shopify Nautical Integration

This is a Prismatic integration between Shopify and Nautical Commerce.

## Development

To develop this integration:

1. Install dependencies:

   ```
   npm install
   ```

2. Build the integration:

   ```
   npm run build
   ```

3. Test the integration:
   ```
   npm test
   ```

## Deployment

This integration can be deployed to Prismatic using the built-in deployment script.

### Prerequisites

1. Create a `.env` file in the root directory with your Prismatic credentials:

   ```
   PRISMATIC_CLIENT_ID=your_client_id_here
   PRISMATIC_CLIENT_SECRET=your_client_secret_here
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Deploy

To deploy the integration:

1. Build the integration:

   ```
   npm run build
   ```

2. Deploy to Prismatic:
   ```
   npm run deploy
   ```

The deployment script will:

1. Build the integration from the source code
2. Publish the integration to your Prismatic account
3. Output the published version number

## CI/CD Integration

For CI/CD pipelines, set the environment variables `PRISMATIC_CLIENT_ID` and `PRISMATIC_CLIENT_SECRET` in your CI/CD platform's secrets management system, then run:

```
npm install
npm run build
npm run deploy
```
