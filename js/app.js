// Grosir Mitra page: price list, restock calculator and order form. Exports the one page
// object (App.page) that the page's buttons and the assistant's site actions share.
import { priceList, quote, CATALOG, RULES } from "./grosir-data.js";
import { OrderBook } from "./order-book.js";

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const hasStorage = (() => { try { return typeof localStorage !== "undefined" && !!localStorage; } catch { return false; } })();

export class GrosirPage {
  constructor(storage, clock = () => new Date()) {
    this.clock = clock;
    this.orders = new OrderBook(storage, clock);
    this.listeners = new Set();
    this.lastOrder = null;
  }
  onChange(fn) { this.listeners.add(fn); }
  changed() { for (const fn of this.listeners) fn(); }

  /** Price list, rules, next delivery day and orders made on this device (no contact details). */
  getState() {
    return { ...priceList(this.clock()), recentOrders: this.orders.recentPublic() };
  }

  quote(items) { return quote(items, this.clock()); }

  checkOrder(args) { return this.orders.check(args.items, OrderPage.details(args)); }

  /** Place an order from the page form or the assistant. */
  placeOrder(args) {
    const r = this.orders.place(args.items, OrderPage.details(args), args.via || "page");
    if (r.ok) { this.lastOrder = r; this.changed(); }
    return r;
  }
}

class OrderPage {
  static details(a) { return { warungName: a.warungName, whatsapp: a.whatsapp, address: a.address, district: a.district }; }
}

export class App {
  static page = new GrosirPage(hasStorage ? localStorage : memoryStorage());
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function mount() {
  const page = App.page;
  const $ = (s) => document.querySelector(s);
  const s = page.getState();
  $("#today").textContent = s.today.label;
  $("#next-delivery").textContent = s.nextDelivery.label;
  $("#rules").innerHTML = `<li>Minimal belanja ${s.rules.minOrderText}.</li><li>Ongkir ${s.rules.deliveryFeeText}, gratis mulai ${s.rules.freeDeliveryFromText}.</li><li>${esc(s.rules.cutoff)}</li><li>Area antar: ${s.rules.districts.join(", ")}.</li><li>${esc(s.rules.payment)}</li>`;
  $("#prices").innerHTML = s.items.map((i) => `<tr class="${i.available ? "" : "off"}"><td>${esc(i.name)}<small>${esc(i.unit)}</small></td><td class="num">${i.priceText}</td>
    <td>${i.available ? `<input type="number" min="0" max="${RULES.maxQtyPerItem}" value="0" data-qty="${i.id}" aria-label="Jumlah ${esc(i.name)}">` : `<span class="muted">${esc(i.note || "kosong")}</span>`}</td></tr>`).join("");
  $("#district").innerHTML = `<option value="">Pilih…</option>` + RULES.districts.map((d) => `<option>${d}</option>`).join("");

  const cartItems = () => [...document.querySelectorAll("[data-qty]")].map((el) => ({ id: el.dataset.qty, qty: Number(el.value) })).filter((l) => l.qty > 0);
  const showQuote = () => {
    const q = page.quote(cartItems());
    $("#quote").innerHTML = q.ok
      ? `<p>${q.lines.map((l) => `${l.qty} × ${esc(l.name)} = ${l.lineTotalText}`).join("<br>")}</p><p>Subtotal ${q.subtotalText} · Ongkir ${q.deliveryFeeText} · <b>Total ${q.totalText}</b></p><p>Diantar ${q.delivery.label}.</p>`
      : `<p class="error">${esc(q.reason)}</p>`;
    return q;
  };
  document.querySelector("#prices").addEventListener("input", showQuote);
  $("#order-form").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const r = page.placeOrder({ items: cartItems(), warungName: f.warungName.value, whatsapp: f.whatsapp.value, address: f.address.value, district: f.district.value });
    $("#order-error").textContent = r.ok ? "" : r.reason;
  };
  const renderOrders = () => {
    const st = page.getState();
    $("#orders").innerHTML = st.recentOrders.map((o) => `<li><b>${o.code}</b> · ${esc(o.items)} · ${o.totalText} · antar ${o.delivery.label}</li>`).join("") || `<li class="muted">Belum ada pesanan dari perangkat ini.</li>`;
    if (page.lastOrder) $("#order-done").textContent = `Pesanan ${page.lastOrder.code} diterima. Total ${page.lastOrder.totalText}, diantar ${page.lastOrder.delivery.label}.`;
  };
  page.onChange(renderOrders);
  renderOrders();
  showQuote();
}

if (typeof document !== "undefined" && document.getElementById("prices")) mount();
export { CATALOG };
