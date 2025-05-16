import React, { useState, useEffect } from "react";
import { Button, Select, Table, Input, Box, Text, Flex } from "@prismatic-io/spectral";

interface AttributeMapping {
  shopifyAttribute: string;
  nauticalAttribute: string;
  description: string;
}

export const MappingUI: React.FC<{
  instanceState: any;
  updateInstanceState: (state: any) => void;
  connections: any;
}> = ({ instanceState, updateInstanceState, connections }) => {
  const [mappings, setMappings] = useState<AttributeMapping[]>([]);
  const [shopifyAttributes, setShopifyAttributes] = useState<string[]>([]);
  const [nauticalAttributes, setNauticalAttributes] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load existing mappings from instance state
    try {
      const existingMappings = JSON.parse(
        instanceState?.attributeMapping?.customMapping || "{}"
      ).mappings || [];
      setMappings(existingMappings);
    } catch (err) {
      setError("Failed to load existing mappings");
      setMappings([]);
    }

    // Fetch Shopify attributes
    fetchShopifyAttributes();
    
    // Fetch Nautical attributes
    fetchNauticalAttributes();
  }, [instanceState, connections]);

  const fetchShopifyAttributes = async () => {
    setLoading(true);
    try {
      // This would typically call the Shopify API to get available product options
      // For demo purposes, we'll use a static list
      setShopifyAttributes([
        "title",
        "description",
        "vendor",
        "product_type",
        "tags",
        "color",
        "size",
        "material",
        "style"
      ]);
    } catch (err) {
      setError("Failed to fetch Shopify attributes");
    } finally {
      setLoading(false);
    }
  };

  const fetchNauticalAttributes = async () => {
    setLoading(true);
    try {
      // This would typically call the Nautical API to get available attributes
      // For demo purposes, we'll use a static list
      setNauticalAttributes([
        "name",
        "description",
        "productType",
        "vendor",
        "color",
        "size",
        "material",
        "style",
        "weight",
        "dimensions"
      ]);
    } catch (err) {
      setError("Failed to fetch Nautical Commerce attributes");
    } finally {
      setLoading(false);
    }
  };

  const addMapping = () => {
    setMappings([
      ...mappings,
      { shopifyAttribute: "", nauticalAttribute: "", description: "" }
    ]);
  };

  const updateMapping = (index: number, field: keyof AttributeMapping, value: string) => {
    const updatedMappings = [...mappings];
    updatedMappings[index][field] = value;
    setMappings(updatedMappings);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const saveMappings = () => {
    try {
      updateInstanceState({
        ...instanceState,
        attributeMapping: {
          ...instanceState.attributeMapping,
          customMapping: JSON.stringify({ mappings }, null, 2)
        }
      });
    } catch (err) {
      setError("Failed to save mappings");
    }
  };

  if (loading) {
    return <Text>Loading attribute options...</Text>;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" mb={4}>
        Shopify to Nautical Commerce Attribute Mapping
      </Text>
      
      <Table>
        <thead>
          <tr>
            <th>Shopify Attribute</th>
            <th>Nautical Attribute</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping, index) => (
            <tr key={index}>
              <td>
                <Select
                  value={mapping.shopifyAttribute}
                  onChange={(e) => updateMapping(index, "shopifyAttribute", e.target.value)}
                >
                  <option value="">Select Shopify Attribute</option>
                  {shopifyAttributes.map((attr) => (
                    <option key={attr} value={attr}>
                      {attr}
                    </option>
                  ))}
                </Select>
              </td>
              <td>
                <Select
                  value={mapping.nauticalAttribute}
                  onChange={(e) => updateMapping(index, "nauticalAttribute", e.target.value)}
                >
                  <option value="">Select Nautical Attribute</option>
                  {nauticalAttributes.map((attr) => (
                    <option key={attr} value={attr}>
                      {attr}
                    </option>
                  ))}
                </Select>
              </td>
              <td>
                <Input
                  value={mapping.description}
                  onChange={(e) => updateMapping(index, "description", e.target.value)}
                  placeholder="Describe this mapping"
                />
              </td>
              <td>
                <Button onClick={() => removeMapping(index)} variant="outline" colorScheme="red">
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Flex mt={4} justifyContent="space-between">
        <Button onClick={addMapping} colorScheme="blue">
          Add Mapping
        </Button>
        <Button onClick={saveMappings} colorScheme="green">
          Save Mappings
        </Button>
      </Flex>
    </Box>
  );
}; 