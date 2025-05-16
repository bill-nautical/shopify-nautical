/**
 * Shopify to Nautical Commerce Integration
 *
 * This integration synchronizes products, inventory, and orders between
 * Shopify and Nautical Commerce platforms.
 */

import { integration } from "@prismatic-io/spectral";
import flows from "./flows";

export default integration({
  name: "Shopify to Nautical Commerce Integration",
  description:
    "Synchronize products, inventory, and orders between Shopify and Nautical Commerce",
  iconPath: "icon.png",
  flows,
});
