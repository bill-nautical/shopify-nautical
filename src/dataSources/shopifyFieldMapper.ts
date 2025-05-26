import {
  dataSource,
  type DataSourceContext,
  type Connection,
  type ObjectFieldMap,
} from "@prismatic-io/spectral";
import { logInfo, logError } from "../utils/logging";

interface ShopifyOption {
  name: string;
  values: string[];
}

interface NauticalAttribute {
  id: string;
  name: string;
  type: string;
  values?: Array<{
    id: string;
    name: string;
  }>;
}

interface NauticalConnection extends Connection {
  fields: {
    apiUrl: string;
    apiKey: string;
    tenantId: string;
  };
}

export const shopifyFieldMapper = dataSource({
  display: {
    label: "Shopify Field Mapper",
    description: "Map Shopify product options to Nautical attributes",
  },

  inputs: {
    connection: {
      label: "Nautical Connection",
      type: "connection",
      required: true,
      comments: "Connection to Nautical Commerce",
    },
  },

  perform: async (context: DataSourceContext, params) => {
    try {
      const connection = params.connection as NauticalConnection;

      // Get Shopify options from the current product
      const shopifyOptions = (context as any).triggerData
        ?.options as ShopifyOption[];

      if (!shopifyOptions) {
        throw new Error("No Shopify options found in the trigger data");
      }

      // Query Nautical attributes
      const query = `
        query GetAttributes {
          attributes(first: 100) {
            nodes {
              id
              name
              type
              values {
                id
                name
              }
            }
          }
        }
      `;

      const response = await fetch(connection.fields.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${connection.fields.apiKey}`,
          "x-nautical-tenant": connection.fields.tenantId,
        },
        body: JSON.stringify({
          query,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch Nautical attributes: ${response.statusText}`
        );
      }

      const responseData = await response.json();
      const nauticalAttributes = responseData.data.attributes
        .nodes as NauticalAttribute[];

      // Create mapping suggestions
      const suggestions = shopifyOptions.map((option) => {
        const matchingAttributes = nauticalAttributes.filter((attr) => {
          // Match by name (case-insensitive)
          const nameMatch =
            attr.name.toLowerCase() === option.name.toLowerCase();

          // Match by type (if option values match attribute values)
          const typeMatch =
            attr.type === "SELECT" &&
            option.values.every((value) =>
              attr.values?.some(
                (attrValue) =>
                  attrValue.name.toLowerCase() === value.toLowerCase()
              )
            );

          return nameMatch || typeMatch;
        });

        return {
          shopifyField: option.name,
          suggestedMappings: matchingAttributes.map((attr) => ({
            id: attr.id,
            name: attr.name,
            type: attr.type,
            confidence: calculateConfidence(option, attr),
          })),
        };
      });

      // Convert suggestions to ObjectFieldMap format
      const fieldMap: ObjectFieldMap = suggestions.reduce((acc, suggestion) => {
        acc[suggestion.shopifyField] = {
          value: suggestion.suggestedMappings[0]?.id || "",
          displayValue:
            suggestion.suggestedMappings[0]?.name || suggestion.shopifyField,
        };
        return acc;
      }, {} as ObjectFieldMap);

      return {
        result: fieldMap,
      };
    } catch (error) {
      const formattedError =
        error instanceof Error ? error : new Error(String(error));
      throw formattedError;
    }
  },

  // Example payload for testing
  examplePayload: {
    result: {
      Size: {
        value: "attr_123",
        displayValue: "Size",
      },
      Color: {
        value: "attr_456",
        displayValue: "Color",
      },
    } as ObjectFieldMap,
  },
});

// Helper function to calculate confidence score for a mapping
function calculateConfidence(
  option: ShopifyOption,
  attribute: NauticalAttribute
): number {
  let score = 0;
  const maxScore = 2;

  // Name match (case-insensitive)
  if (attribute.name.toLowerCase() === option.name.toLowerCase()) {
    score += 1;
  }

  // Value match (if attribute has values)
  if (attribute.values && attribute.type === "SELECT") {
    const matchingValues = option.values.filter((value) =>
      attribute.values?.some(
        (attrValue) => attrValue.name.toLowerCase() === value.toLowerCase()
      )
    );

    if (matchingValues.length === option.values.length) {
      score += 1;
    } else if (matchingValues.length > 0) {
      score += 0.5;
    }
  }

  return score / maxScore;
}
