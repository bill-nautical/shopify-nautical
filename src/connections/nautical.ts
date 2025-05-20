import { connection } from "@prismatic-io/spectral";

export const nauticalConnection = connection({
  key: "nautical",
  label: "Nautical Commerce",
  comments: "Connection to Nautical Commerce",
  inputs: {
    apiUrl: {
      label: "API URL",
      type: "string",
      required: true,
      comments: "Your Nautical Commerce API endpoint",
    },
    apiKey: {
      label: "API Key",
      type: "string",
      required: true,
      comments: "Your Nautical Commerce API key",
    },
    tenantId: {
      label: "Tenant ID",
      type: "string",
      required: true,
      comments: "Your Nautical Commerce tenant ID",
    },
  },
  oauth2Config: undefined,
  dataSourceConfig: {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer {{ apiKey }}",
      "x-nautical-tenant": "{{ tenantId }}",
    },
  },
});
