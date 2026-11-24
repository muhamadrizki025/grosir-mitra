// Registers Grosir Mitra's operations with the agent runtime (agent-manifest.json ->
// actions.module). Each wraps the method the page's own form uses (App.page).
import { App } from "./js/app.js";
import { RULES } from "./js/grosir-data.js";
import { itemsSchema, PRICE_LIST_DESCRIPTION, QUOTE_DESCRIPTION } from "./js/action-defs.js";

class SiteActions {
  static registerActions(actions) {
    for (const def of SiteActions.definitions()) actions.register(def);
  }

  static definitions() {
    return [
      {
        name: "get_price_list",
        description: PRICE_LIST_DESCRIPTION + " On this page it also lists recent orders made on this device.",
        effect: "read",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => App.page.getState(),
      },
      {
        name: "quote_restock",
        description: QUOTE_DESCRIPTION,
        effect: "read",
        inputSchema: { type: "object", additionalProperties: false, required: ["items"], properties: { items: itemsSchema } },
        execute: (args) => App.page.quote(args.items),
      },
      {
        name: "place_restock_order",
        description: "Place a restock order on this page (cash on delivery). Call it only when the visitor asks to order, after website_quote_restock in this turn, with the warung's name, WhatsApp number, address and district the visitor gave. The browser shows the visitor a confirmation dialog first. Returns the order code, total and delivery day, or ok false with the reason.",
        effect: "irreversible",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["items", "warungName", "whatsapp", "address", "district"],
          properties: {
            items: itemsSchema,
            warungName: { type: "string", minLength: 1, maxLength: 80, description: "The warung's name, from the visitor." },
            whatsapp: { type: "string", minLength: 1, maxLength: 24, description: "WhatsApp number for the driver, from the visitor, like 0812xxxxxxx." },
            address: { type: "string", minLength: 1, maxLength: 200, description: "Street address or landmark, from the visitor." },
            district: { type: "string", enum: RULES.districts, description: "Delivery district (kecamatan)." },
          },
        },
        execute: (args) => App.page.placeOrder(args),
      },
    ];
  }
}

export const registerActions = SiteActions.registerActions;
export const definitions = SiteActions.definitions;
