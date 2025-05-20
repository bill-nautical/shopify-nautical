import { component } from "@prismatic-io/spectral";
import { logInfo, logError } from "../utils/logging";
import { withRetry } from "../utils/errorHandling";
import axios from "axios";

// Define types for the component
interface NauticalProductInput {
  title: string;
  description: string;
  variants: Array<{
    sku: string;
    price: string;
    inventoryQuantity: number;
    options: Array<{
      name: string;
      value: string;
    }>;
  }>;
  [key: string]: unknown;
}

interface NauticalConnection {
  fields: {
    apiUrl: string;
    apiKey: string;
    tenantId: string;
  };
}

export const createProduct = component({
  key: "createProduct",
  display: {
    label: "Create Product",
    description: "Create a new product in Nautical Commerce",
    iconPath: "icons/create-product.svg",
    category: "Products",
  },
  actions: {
    create: {
      display: {
        label: "Create Product",
        description: "Create a new product in Nautical Commerce",
      },
      inputs: {
        nauticalConnection: {
          label: "Nautical Connection",
          type: "connection",
          required: true,
          comments: "The Nautical Commerce connection to use",
        },
        title: {
          label: "Product Title",
          type: "string",
          required: true,
          comments: "The title of the product",
        },
        description: {
          label: "Product Description",
          type: "string",
          required: true,
          comments: "The description of the product",
        },
        variants: {
          label: "Product Variants",
          type: "string",
          required: true,
          comments: "JSON string of product variants",
        },
      },
      perform: async (context, params) => {
        const { nauticalConnection, title, description, variants } = params;
        const { apiUrl, apiKey, tenantId } = (
          nauticalConnection as NauticalConnection
        ).fields;

        try {
          logInfo(context, "Creating product in Nautical Commerce", {
            title,
            variantCount: JSON.parse(variants).length,
          });

          const productCreateMutation = `
            mutation ProductCreate($input: ProductCreateInput!) {
              productCreate(input: $input) {
                product {
                  id
                  name
                }
                errors {
                  field
                  message
                }
              }
            }
          `;

          const productInput = {
            name: title,
            description,
            variants: JSON.parse(variants),
          };

          const response = await withRetry(
            () =>
              axios.post(
                apiUrl,
                {
                  query: productCreateMutation,
                  variables: { input: productInput },
                },
                {
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "x-nautical-tenant": tenantId,
                    "Content-Type": "application/json",
                  },
                }
              ),
            3,
            1000,
            context
          );

          if (
            response.data.errors ||
            response.data.data?.productCreate?.errors?.length > 0
          ) {
            const errorDetails =
              response.data.errors || response.data.data?.productCreate?.errors;
            throw new Error(
              `Error creating product: ${JSON.stringify(errorDetails)}`
            );
          }

          const createdProduct = response.data.data.productCreate.product;
          logInfo(
            context,
            "Successfully created product in Nautical Commerce",
            {
              productId: createdProduct.id,
              productName: createdProduct.name,
            }
          );

          return { data: createdProduct };
        } catch (error) {
          const formattedError =
            error instanceof Error ? error : new Error(String(error));
          logError(
            context,
            "Failed to create product in Nautical Commerce",
            formattedError
          );
          throw formattedError;
        }
      },
    },
  },
});
