// Shared action definitions for the page (site-actions.js) and the cross-site bridge
// (bridge/bridge-actions.js), so both read the same rules with the same input.
import { ITEM_IDS, RULES } from "./grosir-data.js";

export const itemsSchema = {
  type: "array",
  minItems: 1,
  maxItems: 10,
  description: "Restock lines: item id from website_get_price_list and quantity in that item's unit (dus, bal, karung…).",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "qty"],
    properties: {
      id: { type: "string", enum: ITEM_IDS, description: "Item id from website_get_price_list." },
      qty: { type: "integer", minimum: 1, maximum: RULES.maxQtyPerItem, description: "How many units (dus/bal/karung)." },
    },
  },
};

export const PRICE_LIST_DESCRIPTION = "Read Grosir Mitra's wholesale price list (item ids, names, units, prices, which are out of stock), the minimum order, delivery fee and free-delivery threshold, cut-off time, delivery areas, payment, today's date and the next delivery day. Changes nothing. Call it before answering about items or prices.";
export const QUOTE_DESCRIPTION = "Price a restock with the site's own rules: line totals, subtotal, delivery fee, total and delivery day, or ok false with the reason (unknown or out-of-stock item, quantity out of range, under the minimum order). Changes nothing. Map the visitor's words to ids from website_get_price_list first.";
