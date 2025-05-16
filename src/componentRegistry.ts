import { component } from "@prismatic-io/spectral";
import { MappingUI } from "./components/MappingUI";

// Register custom components for the integration
export const componentRegistry = {
  mappingUI: component({
    key: "mappingUI",
    display: {
      label: "Attribute Mapping UI",
      description:
        "UI component for mapping Shopify product options to Nautical Commerce attributes",
    },
    component: MappingUI,
    version: "1.0.0",
    isPublic: false,
  }),
};

export default componentRegistry;
