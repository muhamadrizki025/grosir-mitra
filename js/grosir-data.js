// Grosir Mitra — catalog and pricing rules. Pure: no DOM, so the page, the agent's site
// actions, the cross-site bridge and the Node tests all use these exact rules.
// DEMO DATA: prices are sample figures for the Open Agentic Web demo, not a real offer.

export const TIME_ZONE = "Asia/Jakarta";

export const CATALOG = [
  { id: "minyak_2l_dus", name: "Minyak goreng 2 L", unit: "dus isi 6 pouch", price: 204000, available: true },
  { id: "minyak_1l_dus", name: "Minyak goreng 1 L", unit: "dus isi 12 pouch", price: 210000, available: true },
  { id: "beras_5kg", name: "Beras premium 5 kg", unit: "karung 5 kg", price: 74000, available: true },
  { id: "gula_1kg_bal", name: "Gula pasir 1 kg", unit: "bal isi 10", price: 178000, available: true },
  { id: "terigu_1kg_bal", name: "Tepung terigu 1 kg", unit: "bal isi 10", price: 124000, available: true },
  { id: "mie_goreng_dus", name: "Mi instan goreng", unit: "dus isi 40", price: 118000, available: true },
  { id: "mie_kuah_dus", name: "Mi instan kuah", unit: "dus isi 40", price: 112000, available: true },
  { id: "kopi_sachet_pak", name: "Kopi sachet", unit: "pak isi 12 renceng", price: 126000, available: true },
  { id: "air_600_dus", name: "Air mineral 600 ml", unit: "dus isi 24", price: 46000, available: true },
  { id: "telur_peti", name: "Telur ayam", unit: "peti 15 kg", price: 405000, available: false, note: "Sedang kosong, belum ada jadwal masuk." },
];

export const RULES = {
  minOrder: 150000,
  freeDeliveryFrom: 300000,
  deliveryFee: 15000,
  maxQtyPerItem: 50,
  cutoffHour: 14,
  districts: ["Karawang Timur", "Karawang Barat", "Telukjambe Timur", "Klari", "Purwasari"],
  noDeliveryWeekday: 0, // Sunday
  payment: "Bayar tunai saat barang diterima (COD).",
};

export const ITEM_IDS = CATALOG.map((i) => i.id);

export const rupiah = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

function jakartaParts(date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export function longDate(iso) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00Z"));
}

/** Next delivery day for an order placed at `now`: next day if before 14:00 WIB, else the day after; never Sunday. */
export function deliveryDay(now) {
  const { iso, hour } = jakartaParts(now);
  let d = new Date(iso + "T00:00:00Z");
  d = new Date(d.getTime() + (hour < RULES.cutoffHour ? 1 : 2) * 86_400_000);
  while (d.getUTCDay() === RULES.noDeliveryWeekday) d = new Date(d.getTime() + 86_400_000);
  const out = d.toISOString().slice(0, 10);
  return { date: out, label: longDate(out) };
}

export function today(now) {
  const { iso, hour } = jakartaParts(now);
  return { date: iso, label: longDate(iso), hourWIB: hour };
}

/** The public price list with the rules, as the page shows it. */
export function priceList(now = new Date()) {
  return {
    today: today(now),
    demoNotice: "Harga contoh untuk demo Open Agentic Web, bukan penawaran nyata.",
    items: CATALOG.map((i) => ({ id: i.id, name: i.name, unit: i.unit, price: i.price, priceText: rupiah(i.price), available: i.available, ...(i.note ? { note: i.note } : {}) })),
    rules: {
      minOrderText: rupiah(RULES.minOrder),
      freeDeliveryFromText: rupiah(RULES.freeDeliveryFrom),
      deliveryFeeText: rupiah(RULES.deliveryFee),
      maxQtyPerItem: RULES.maxQtyPerItem,
      cutoff: `Pesan sebelum ${RULES.cutoffHour}.00 WIB, diantar besok. Minggu libur antar.`,
      districts: RULES.districts,
      payment: RULES.payment,
    },
    nextDelivery: deliveryDay(now),
  };
}

/**
 * Price a restock: items [{id, qty}]. Read-only. Refuses unknown, unavailable,
 * duplicate or out-of-range lines, and totals under the minimum order.
 */
export function quote(items, now = new Date()) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, field: "items", reason: "Sebutkan minimal satu barang dan jumlahnya." };
  const seen = new Set();
  const lines = [];
  for (const line of items) {
    const item = CATALOG.find((c) => c.id === line?.id);
    if (!item) return { ok: false, field: "items", reason: `Barang "${line?.id}" tidak ada di daftar harga.` };
    if (seen.has(item.id)) return { ok: false, field: "items", reason: `${item.name} disebut dua kali. Gabungkan jumlahnya.` };
    seen.add(item.id);
    if (!item.available) return { ok: false, field: "items", reason: `${item.name} (${item.unit}): ${item.note || "sedang kosong"}` };
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > RULES.maxQtyPerItem) return { ok: false, field: "items", reason: `Jumlah ${item.name} harus 1–${RULES.maxQtyPerItem} ${item.unit.split(" ")[0]}.` };
    lines.push({ id: item.id, name: item.name, unit: item.unit, qty: line.qty, price: item.price, priceText: rupiah(item.price), lineTotal: item.price * line.qty, lineTotalText: rupiah(item.price * line.qty) });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  if (subtotal < RULES.minOrder) return { ok: false, field: "items", reason: `Minimal belanja ${rupiah(RULES.minOrder)}; pesanan ini baru ${rupiah(subtotal)}.`, subtotalText: rupiah(subtotal) };
  const fee = subtotal >= RULES.freeDeliveryFrom ? 0 : RULES.deliveryFee;
  return {
    ok: true,
    lines,
    subtotal, subtotalText: rupiah(subtotal),
    deliveryFee: fee, deliveryFeeText: fee ? rupiah(fee) : "Gratis",
    total: subtotal + fee, totalText: rupiah(subtotal + fee),
    delivery: deliveryDay(now),
    payment: RULES.payment,
    demoNotice: "Harga contoh untuk demo.",
  };
}
