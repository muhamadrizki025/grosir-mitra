// What Grosir Mitra shares with other agent sites through its action bridge. Runs in a
// hidden frame (reads) or in Grosir Mitra's own window (the order) on this site's origin,
// with this site's own code. Nothing here reads a visitor's page or orders.
import { priceList, quote } from "../js/grosir-data.js";
import { itemsSchema, PRICE_LIST_DESCRIPTION, QUOTE_DESCRIPTION } from "../js/action-defs.js";
import { OrderWindow } from "./write-window.js";

class BridgeActions {
  // Public facts the page itself shows (prices, rules), so any agent site may read them.
  static PUBLIC = ["*"];

  static registerActions(actions) {
    actions.register({
      name: "get_price_list",
      description: PRICE_LIST_DESCRIPTION,
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.PUBLIC,
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => priceList(new Date()),
    });
    actions.register({
      name: "quote_restock",
      description: QUOTE_DESCRIPTION,
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.PUBLIC,
      inputSchema: { type: "object", additionalProperties: false, required: ["items"], properties: { items: itemsSchema } },
      execute: (args) => quote(args.items, new Date()),
    });
    actions.register(OrderWindow.definition());
  }
}

export const registerActions = BridgeActions.registerActions;
