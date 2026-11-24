// Node tests for Grosir Mitra: pricing rules, orders, actions vs manifest, bridge sharing,
// and the published network JSON through the runtime's validator.
//   node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { quote, deliveryDay, priceList, RULES } from "../js/grosir-data.js";
import { OrderBook } from "../js/order-book.js";
import { AgentNetwork, validateNetwork } from "../runtime/kernel.js";

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const json = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const at = (iso) => () => new Date(iso);
const D = { warungName: "Warung Bu Sri", whatsapp: "081234567890", address: "Jl. Margasari No. 5", district: "Karawang Timur" };

test("quote: totals by hand, delivery fee threshold on both sides", () => {
  const q = quote([{ id: "minyak_2l_dus", qty: 3 }]);
  assert.equal(q.totalText, "Rp 612.000"); assert.equal(q.deliveryFeeText, "Gratis");
  const q2 = quote([{ id: "mie_goreng_dus", qty: 2 }]); // 236k < 300k
  assert.equal(q2.total, 236000 + 15000);
  const q3 = quote([{ id: "beras_5kg", qty: 2 }, { id: "air_600_dus", qty: 1 }]); // 148k + 46k = 194k
  assert.equal(q3.subtotal, 194000); assert.equal(q3.deliveryFee, 15000);
  const edge = quote([{ id: "air_600_dus", qty: 3 }, { id: "beras_5kg", qty: 2 }, { id: "kopi_sachet_pak", qty: 0 + 1 }]); // 138+148+126 = 412k
  assert.equal(edge.deliveryFee, 0);
});

test("quote refusals: unknown, out of stock, duplicate, qty bounds, minimum order", () => {
  assert.equal(quote([]).ok, false);
  assert.match(quote([{ id: "rokok", qty: 1 }]).reason, /tidak ada/);
  assert.match(quote([{ id: "telur_peti", qty: 1 }]).reason, /kosong/);
  assert.match(quote([{ id: "beras_5kg", qty: 2 }, { id: "beras_5kg", qty: 1 }]).reason, /dua kali/);
  assert.equal(quote([{ id: "beras_5kg", qty: RULES.maxQtyPerItem + 1 }]).ok, false);
  assert.equal(quote([{ id: "beras_5kg", qty: RULES.maxQtyPerItem }]).ok, true);
  assert.match(quote([{ id: "air_600_dus", qty: 3 }]).reason, /Minimal belanja/); // 138k
});

test("delivery day: cut-off 14:00 WIB and no Sunday", () => {
  assert.equal(deliveryDay(new Date("2026-11-24T06:59:00Z")).date, "2026-11-25"); // Tue 13:59 WIB
  assert.equal(deliveryDay(new Date("2026-11-24T07:00:00Z")).date, "2026-11-26"); // Tue 14:00 WIB
  assert.equal(deliveryDay(new Date("2026-11-28T03:00:00Z")).date, "2026-11-30"); // Sat morning -> Mon
  assert.equal(deliveryDay(new Date("2026-11-27T10:00:00Z")).date, "2026-11-30"); // Fri 17:00 -> Sun -> Mon
});

test("orders: details checked, stored, receipt has no contact details", () => {
  const book = new OrderBook(mem(), at("2026-11-24T03:00:00Z"), () => 0.1);
  assert.equal(book.place([{ id: "minyak_2l_dus", qty: 1 }], { ...D, whatsapp: "12345" }).ok, false);
  assert.equal(book.place([{ id: "minyak_2l_dus", qty: 1 }], { ...D, district: "Bekasi" }).ok, false);
  assert.equal(book.all().length, 0);
  const r = book.place([{ id: "minyak_2l_dus", qty: 1 }], D);
  assert.equal(r.ok, true); assert.match(r.code, /^GM-[A-Z0-9]{5}$/);
  assert.ok(!JSON.stringify(r).includes("0812") && !JSON.stringify(book.recentPublic()).includes("Margasari"));
  assert.equal(book.all()[0].details.whatsapp, "081234567890");
});

test("actions: page and bridge names cover manifest agentTools; sharing rules", async () => {
  globalThis.localStorage = mem();
  const manifest = await json("../agent-manifest.json");
  const page = (await import("../site-actions.js")).definitions();
  const bridge = [];
  (await import("../bridge/bridge-actions.js")).registerActions({ register: (d) => bridge.push(d) });
  const names = new Set([...page.map((d) => d.name), ...bridge.map((d) => d.name)]);
  assert.deepEqual([...names].sort(), [...manifest.actions.agentTools].sort());
  const b = Object.fromEntries(bridge.map((d) => [d.name, d]));
  assert.deepEqual(b.get_price_list.callerOrigins, ["*"]);
  assert.equal(b.order_restock.confirmsInWindow, true);
  assert.ok(!b.order_restock.callerOrigins.includes("*"));
  assert.deepEqual(Object.keys(b.order_restock.inputSchema.properties), ["items"]); // never names/phones
  assert.equal(page.find((d) => d.name === "place_restock_order").effect, "irreversible");
  assert.ok(priceList().items.length >= 5);
});

test("published network JSON passes the runtime validator", async () => {
  const manifest = await json("../agent-manifest.json");
  const net = manifest.networks[0];
  const network = new AgentNetwork(await json("../" + net.hocon), net.name);
  assert.deepEqual(validateNetwork(network).errors, []);
  assert.equal(network.findFrontMan(), net.front_man);
  const bm = await json("../bridge/agent-manifest.json");
  assert.equal(bm.actions.module, "./bridge-actions.js");
});
