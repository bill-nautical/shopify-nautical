// src/utils/dataTransformation.ts

// Transform Shopify product to Nautical Commerce format
export function transformShopifyProductToNautical(
  shopifyProduct,
  attributeMappings
) {
  // Extract base product data
  const baseProduct = {
    name: shopifyProduct.title,
    description: shopifyProduct.descriptionHtml || shopifyProduct.description,
    productType: shopifyProduct.productType,
    vendor: shopifyProduct.vendor,
    status: mapShopifyStatusToNautical(shopifyProduct.status),
    attributes: extractAttributes(shopifyProduct, attributeMappings),
    externalId: shopifyProduct.id,
    externalSource: "shopify",
  };

  // Extract variants
  const variants = shopifyProduct.variants.edges.map(({ node }) => ({
    sku: node.sku,
    price: node.price,
    compareAtPrice: node.compareAtPrice,
    inventoryQuantity: node.inventoryQuantity,
    attributes: extractVariantAttributes(
      node,
      shopifyProduct.options,
      attributeMappings
    ),
    externalId: node.id,
    externalSource: "shopify",
  }));

  return {
    ...baseProduct,
    variants,
  };
}

// Extract attributes based on mapping
function extractAttributes(shopifyProduct, attributeMappings) {
  const attributes = {};

  // Apply mappings for product-level attributes
  for (const mapping of attributeMappings) {
    if (shopifyProduct[mapping.shopifyAttribute]) {
      attributes[mapping.nauticalAttribute] =
        shopifyProduct[mapping.shopifyAttribute];
    }
  }

  return attributes;
}

// Extract variant attributes based on mapping
function extractVariantAttributes(variant, options, attributeMappings) {
  const attributes = {};

  // Map selected options to Nautical Commerce attributes
  for (const option of variant.selectedOptions) {
    const mapping = attributeMappings.find(
      (m) => m.shopifyAttribute === option.name
    );
    if (mapping) {
      attributes[mapping.nauticalAttribute] = option.value;
    } else {
      // Default to using the same name if no mapping exists
      attributes[option.name.toLowerCase()] = option.value;
    }
  }

  return attributes;
}

// Map Shopify product status to Nautical Commerce status
function mapShopifyStatusToNautical(shopifyStatus) {
  const statusMap = {
    ACTIVE: "PUBLISHED",
    DRAFT: "DRAFT",
    ARCHIVED: "ARCHIVED",
  };
  return statusMap[shopifyStatus] || "DRAFT";
}
