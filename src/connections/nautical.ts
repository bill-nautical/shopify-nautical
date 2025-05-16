import { connection } from "@prismatic-io/spectral";

export const nauticalConnection = connection({
  key: "nautical",
  label: "Nautical Commerce",
  comments: "Connection to Nautical Commerce API",
  inputs: {
    apiUrl: {
      label: "API URL",
      type: "string",
      required: true,
      placeholder: "https://api-{your_domain}.com/graphql/",
      comments: "The Nautical Commerce GraphQL API endpoint"
    },
    apiKey: {
      label: "API Key",
      type: "password",
      required: true,
      placeholder: "your-api-key",
      comments: "The Nautical Commerce API key"
    },
    tenantId: {
      label: "Tenant ID",
      type: "string",
      required: true,
      placeholder: "7bec1fcd",
      comments: "The Nautical Commerce tenant ID for multi-tenant environments"
    }
  },
  oauth2Config: undefined,
  dataSourceConfig: {
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer {{ apiKey }}",
      "x-nautical-tenant": "{{ tenantId }}"
    }
  }
}); 