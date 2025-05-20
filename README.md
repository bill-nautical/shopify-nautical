# Shopify to Nautical Commerce Integration

This integration connects Shopify and Nautical Commerce, enabling seamless product synchronization between the two platforms.

## Features

- Product Import: Import products from Shopify to Nautical Commerce
- Inventory Sync: Keep inventory levels synchronized between platforms
- Order Sync: Synchronize orders between platforms
- Webhook Support: Real-time updates via webhooks

## Prerequisites

- Shopify store with API access
- Nautical Commerce account with API credentials
- Prismatic account

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the integration:

   ```bash
   npm run build
   ```

3. Import into Prismatic:
   ```bash
   npm run import
   ```

## Configuration

### Shopify Connection

- Shop Domain: Your Shopify store domain (e.g., `your-store.myshopify.com`)
- API Key: Your Shopify Admin API access token

### Nautical Commerce Connection

- API URL: Your Nautical Commerce API endpoint
- API Key: Your Nautical Commerce API key
- Tenant ID: Your Nautical Commerce tenant ID

### Webhook Setup

1. In your Shopify admin, go to Settings > Notifications > Webhooks
2. Add a new webhook:
   - Event: Product updates
   - Format: JSON
   - URL: Your Prismatic webhook URL
   - Version: 2023-04

## Usage

### Product Import

1. Navigate to the "Product Import" flow in Prismatic
2. Configure attribute mappings if needed
3. Run the flow to import products

### Inventory Sync

1. Navigate to the "Inventory Sync" flow
2. Configure sync settings
3. Enable the flow for automatic synchronization

### Order Sync

1. Navigate to the "Order Sync" flow
2. Configure order mapping settings
3. Enable the flow for automatic synchronization

## Development

### Project Structure

```
src/
  ├── components/     # Prismatic components
  ├── connections/    # Connection definitions
  ├── flows/         # Integration flows
  ├── utils/         # Utility functions
  └── index.ts       # Main integration file
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Support

For support, please contact your Prismatic administrator or open an issue in this repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
