// Grosir Mitra — restock orders. Pure (storage is passed in), so the page, the bridge's
// order window and the Node tests share the same checks. A static demo site has no
// server: orders are kept in this browser's storage on the Grosir Mitra origin.
import { quote, RULES } from "./grosir-data.js";

const KEY = "grosir-mitra:orders";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class OrderBook {
  constructor(storage, clock = () => new Date(), random = Math.random) {
    this.storage = storage;
    this.clock = clock;
    this.random = random;
  }

  all() {
    try { return JSON.parse(this.storage.getItem(KEY)) || []; } catch { return []; }
  }

  /** The owner's own details. Returns {field: message}; empty when fine. */
  detailErrors(details) {
    const e = {};
    const name = String(details?.warungName ?? "").trim();
    const wa = String(details?.whatsapp ?? "").replace(/[\s-]/g, "");
    const address = String(details?.address ?? "").trim();
    if (name.length < 3 || name.length > 60) e.warungName = "Nama warung 3–60 huruf.";
    if (!/^(\+62|62|0)8\d{7,11}$/.test(wa)) e.whatsapp = "Nomor WhatsApp seperti 0812xxxxxxx.";
    if (address.length < 8 || address.length > 160) e.address = "Alamat/patokan 8–160 huruf.";
    if (!RULES.districts.includes(details?.district)) e.district = `Kecamatan harus salah satu: ${RULES.districts.join(", ")}.`;
    return e;
  }

  /** Read-only check of a whole order; the confirmation dialog and the window call it. */
  check(items, details) {
    const q = quote(items, this.clock());
    if (!q.ok) return q;
    if (details) {
      const errors = this.detailErrors(details);
      const fields = Object.keys(errors);
      if (fields.length) return { ok: false, field: fields[0], reason: fields.map((f) => errors[f]).join(" "), errors };
    }
    return q;
  }

  newCode() {
    let s = "GM-";
    for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(this.random() * CODE_CHARS.length)];
    return s;
  }

  /** Place the order. Returns a receipt with the code; the owner's details stay here. */
  place(items, details, via = "page") {
    const q = this.check(items, details);
    if (!q.ok) return q;
    const order = {
      code: this.newCode(),
      placedAt: this.clock().toISOString(),
      via,
      lines: q.lines.map((l) => ({ id: l.id, name: l.name, unit: l.unit, qty: l.qty, lineTotalText: l.lineTotalText })),
      totalText: q.totalText,
      deliveryFeeText: q.deliveryFeeText,
      delivery: q.delivery,
      details: { warungName: details.warungName.trim(), whatsapp: details.whatsapp.trim(), address: details.address.trim(), district: details.district },
      status: "Diterima — menunggu pengantaran (demo)",
    };
    const all = this.all();
    all.unshift(order);
    this.storage.setItem(KEY, JSON.stringify(all.slice(0, 50)));
    return {
      ok: true,
      code: order.code,
      summary: order.lines.map((l) => `${l.qty} × ${l.name} (${l.unit})`).join(", "),
      totalText: order.totalText,
      deliveryFeeText: order.deliveryFeeText,
      delivery: order.delivery,
      payment: RULES.payment,
      status: order.status,
    };
  }

  /** Orders made on this device, without the owner's contact details. */
  recentPublic() {
    return this.all().slice(0, 5).map((o) => ({ code: o.code, placedAt: o.placedAt, items: o.lines.map((l) => `${l.qty} × ${l.name}`).join(", "), totalText: o.totalText, delivery: o.delivery, status: o.status }));
  }
}
