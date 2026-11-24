// A write this site shares with other agent sites, such as a booking or an order.
// bridge-actions.js registers it.
//
// A partner's write runs in a window on this site that the visitor sees, not in the
// partner's page. This module shows there what will happen and a form for the visitor's
// own details, with the site's stylesheet. The calling assistant gets back only a
// reference and what was done, never what the visitor typed.
//
// Grosir Mitra's restock order, shared with the Kasbon Warung site. The owner checks the
// order and types her own details (warung name, WhatsApp, address) here, never in the chat.
import { OrderBook } from "../js/order-book.js";
import { RULES } from "../js/grosir-data.js";
import { itemsSchema } from "../js/action-defs.js";

/**
 * Shares one write, made in one call, with the rules the page's own form uses.
 *
 * The window starts a fresh store, like a fresh page, so it cannot see what the visitor
 * did on the site's page, such as a basket. A site with no server keeps the change only
 * in this window. A real site sends it to its own server in submit.
 */
export class OrderWindow {
  /**
   * The sites allowed to make this write, as exact origins with the port. Never "*".
   * Only the Kasbon Warung site (Buku Bon Agentik) may make it.
   */
  static CALLERS = [
    "https://muhamadrizki025.github.io",
  ];

  /**
   * The visitor's own details, which the agents never see: the fields the page's
   * own form asks for, with the store's names.
   */
  static FIELDS = [
    { name: "warungName", label: "Nama warung", type: "text", autocomplete: "organization", maxLength: 60 },
    { name: "whatsapp", label: "Nomor WhatsApp (untuk kurir)", type: "tel", autocomplete: "tel", maxLength: 20 },
    { name: "address", label: "Alamat / patokan", type: "text", autocomplete: "street-address", maxLength: 160 },
    { name: "district", label: "Kecamatan", type: "select", options: RULES.districts },
  ];

  /**
   * The site's name, for the window's header and title.
   */
  static SITE_NAME = "Grosir Mitra";

  /**
   * The confirm button's label, which says what it does.
   */
  static CONFIRM_LABEL = "Pesan sekarang (bayar saat diantar)";

  /**
   * Describe the shared write.
   *
   * :return: The action definition.
   */
  static definition() {
    return {
      // A name the page has no action for (the page uses place_restock_order).
      name: "order_restock",
      // Say that a window opens and that the visitor types their own details, so the agent
      // never asks for them, and what comes back.
      description: "Order a restock from Grosir Mitra in one call (cash on delivery). Call website_quote_restock first and use its ids. Call it only when the visitor asks to order. A window opens on Grosir Mitra, where the visitor checks the order and types the warung name, WhatsApp and address, so never ask for them. It returns once the visitor confirmed or cancelled there. Returns the order code, items, total and delivery day, or ok false with the reason.",
      // "irreversible" for a change the visitor cannot undo, such as a booking or an order,
      // or "write" for one they can. A partner's write opens this window either way.
      effect: "irreversible",
      availability: "bridge",
      callerOrigins: OrderWindow.CALLERS,
      // The form below shows the change and asks the visitor to confirm or cancel, so the
      // bridge's generic dialog of the raw arguments is not needed.
      confirmsInWindow: true,
      // Only what the agent knows: items and quantities.
      // Never names, emails, phone numbers or addresses.
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: { items: itemsSchema },
      },
      execute: OrderWindow.start,
    };
  }

  /**
   * Check the request with the site's rules, then ask the visitor in this window.
   *
   * :param args: The validated request.
   * :param context: The bridge's call details, with the calling site's origin.
   * :return: A refusal now, or a promise of the result or the visitor's cancel.
   */
  static start(args, context) {
    const store = new OrderBook(localStorage);
    // A request the site would refuse gets no form, only the site's reason.
    const check = store.check(args.items);
    if (!check.ok) {
      return {
        ok: false,
        reason: check.reason,
      };
    }
    const state = {
      store: store,
      request: args,
      caller: OrderWindow.hostOf(context?.callerOrigin),
      done: false,
    };
    return new Promise(OrderWindow.showForm.bind(null, state));
  }

  /**
   * Show what will happen and the details form, and wait for the visitor.
   *
   * :param state: The store, the request, the caller and whether the form is done.
   * :param resolve: Resolves the action with its result.
   */
  static showForm(state, resolve) {
    state.resolve = resolve;
    document.title = OrderWindow.SITE_NAME;
    OrderWindow.addStyles();
    const box = OrderWindow.element("main", "");
    box.append(
      OrderWindow.intro(state),
      OrderWindow.summaryCard(state),
      OrderWindow.form(state, box),
    );
    document.body.append(OrderWindow.header(), box);
    state.form.elements[OrderWindow.FIELDS[0].name].focus();
  }

  /**
   * Add the site's stylesheet to the page head.
   */
  static addStyles() {
    // Resolved from this module, so the bridge page's own location does not matter.
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    // The site's stylesheet.
    sheet.href = new URL("../styles.css", import.meta.url).href;
    document.documentElement.lang = "id";
    document.head.append(sheet);
  }

  /**
   * Make the site's header, with its name, so the visitor sees whose window this is.
   *
   * :return: The header element.
   */
  static header() {
    const header = document.createElement("header");
    header.append(OrderWindow.element("span", OrderWindow.SITE_NAME, "brand"));
    return header;
  }

  /**
   * Say which site asked for this, and where the visitor's details go.
   *
   * :param state: The window's state, with the caller's host.
   * :return: The intro section.
   */
  static intro(state) {
    const intro = OrderWindow.element("section", "", "intro");
    intro.append(
      OrderWindow.element("h1", "Konfirmasi pesanan restock"),
      OrderWindow.element("p", `Asisten di ${state.caller} meminta Grosir Mitra menyiapkan pesanan ini. Isi data Anda di sini, bukan di chat. Setelah Anda konfirmasi, chat itu hanya menerima kode pesanan dan ringkasannya — bukan data Anda.`),
    );
    return intro;
  }

  /**
   * Show what will happen and what it costs, with the site's own terms.
   *
   * :param state: The window's state, with the store and the request.
   * :return: The summary section.
   */
  static summaryCard(state) {
    const card = OrderWindow.element("section", "", "panel");
    card.setAttribute("aria-label", "What you are confirming");
    const q = state.store.check(state.request.items);
    for (const l of q.lines) {
      card.append(OrderWindow.element("p", `${l.qty} × ${l.name} (${l.unit}) — ${l.lineTotalText}`));
    }
    card.append(
      OrderWindow.element("p", `Subtotal ${q.subtotalText} · Ongkir ${q.deliveryFeeText} · Total ${q.totalText}`),
      OrderWindow.element("p", `Diantar ${q.delivery.label}. ${q.payment}`),
      OrderWindow.element("p", q.demoNotice),
    );
    return card;
  }

  /**
   * Make the details form, with the confirm button and Cancel.
   *
   * :param state: The window's state. The form and its error lines are stored on it.
   * :param box: The window's content, replaced once the visitor confirms or cancels.
   * :return: The form.
   */
  static form(state, box) {
    const form = OrderWindow.element("form", "", "panel");
    form.noValidate = true;
    state.form = form;
    state.messages = {};
    // A problem with the request itself, found when the visitor confirms, shows first.
    state.messages.request = OrderWindow.message("request");
    state.messages.request.setAttribute("role", "alert");
    const fieldset = document.createElement("fieldset");
    fieldset.append(OrderWindow.element("legend", "Data warung Anda"));
    for (const field of OrderWindow.FIELDS) {
      fieldset.append(OrderWindow.field(state, field));
    }
    const confirmButton = OrderWindow.element("button", OrderWindow.CONFIRM_LABEL);
    confirmButton.type = "submit";
    const cancelButton = OrderWindow.element("button", "Batal", "secondary");
    cancelButton.type = "button";
    const actions = OrderWindow.element("div", "", "actions");
    actions.append(confirmButton, cancelButton);
    form.append(state.messages.request, fieldset, actions);
    form.addEventListener("submit", OrderWindow.submit.bind(null, state, box));
    cancelButton.addEventListener("click", OrderWindow.cancel.bind(null, state, box));
    return form;
  }

  /**
   * Make one labelled input with its error line.
   *
   * :param state: The window's state. The field's error line is stored on it.
   * :param field: The field from FIELDS.
   * :return: The field's wrapper.
   */
  static field(state, field) {
    const id = `write-${field.name}`;
    const wrap = OrderWindow.element("div", "", "field");
    const label = OrderWindow.element("label", field.label);
    label.htmlFor = id;
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      input.append(new Option("Pilih…", ""));
      for (const option of field.options) {
        input.append(new Option(option, option));
      }
    } else {
      input = document.createElement("input");
      input.type = field.type;
      input.autocomplete = field.autocomplete;
      input.maxLength = field.maxLength;
    }
    input.id = id;
    input.name = field.name;
    input.required = true;
    state.messages[field.name] = OrderWindow.message(field.name);
    input.setAttribute("aria-describedby", state.messages[field.name].id);
    wrap.append(label, input, state.messages[field.name]);
    return wrap;
  }

  /**
   * Check the details with the site's rules, and make the change when they pass.
   *
   * :param state: The window's state, with the form, the store and the resolver.
   * :param box: The window's content, replaced once the change is made.
   * :param event: The submit event.
   */
  static submit(state, box, event) {
    event.preventDefault();
    if (state.done) {
      return;
    }
    const details = {};
    for (const field of OrderWindow.FIELDS) {
      details[field.name] = state.form.elements[field.name].value;
    }
    const errors = state.store.detailErrors(details);
    const recheck = state.store.check(state.request.items);
    if (!recheck.ok) {
      errors.request = recheck.reason;
    }
    OrderWindow.showErrors(state, errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    // The same call the page's own form makes. A real wholesaler would send it to its server.
    const done = state.store.place(state.request.items, details, "partner:" + state.caller);
    if (!done.ok) {
      OrderWindow.showErrors(state, { request: done.reason });
      return;
    }
    state.done = true;
    box.replaceChildren(OrderWindow.confirmation(state, done));
    state.resolve(OrderWindow.result(done));
  }

  /**
   * Show each error under its field, mark the field invalid, and focus the first one.
   *
   * :param state: The window's state, with the form and its error lines.
   * :param errors: The store's errors by field name, empty when all is fine.
   */
  static showErrors(state, errors) {
    let first = null;
    for (const name of Object.keys(state.messages)) {
      const text = errors[name] || "";
      state.messages[name].textContent = text;
      state.messages[name].hidden = !text;
      const input = state.form.elements[name];
      if (input) {
        input.setAttribute("aria-invalid", text ? "true" : "false");
        if (text && !first) {
          first = input;
        }
      }
    }
    first?.focus();
  }

  /**
   * Show the result in this window, with what was ordered and where it goes.
   *
   * :param state: The window's state, with the caller's host.
   * :param done: The store's result, with its reference.
   * :return: The confirmation section.
   */
  static confirmation(state, done) {
    const box = OrderWindow.element("section", "", "confirmation");
    box.append(
      OrderWindow.element("h2", "Pesanan diterima"),
      OrderWindow.element("p", `Kode pesanan: ${done.code}. ${done.summary}. Total ${done.totalText}, diantar ${done.delivery.label}.`),
      OrderWindow.element("p", `Jendela ini akan tertutup. Chat di ${state.caller} juga menerima kode pesanan.`),
    );
    return box;
  }

  /**
   * End the action without a change, after the visitor clicks Cancel.
   *
   * :param state: The resolver, the caller's host and whether the form is done.
   * :param box: The window's content.
   */
  static cancel(state, box) {
    if (state.done) {
      return;
    }
    state.done = true;
    const notice = OrderWindow.element("section", "", "panel");
    notice.append(
      OrderWindow.element("h2", "Dibatalkan"),
      OrderWindow.element("p", `Tidak ada pesanan. Jendela ini akan tertutup, dan chat di ${state.caller} berlanjut.`),
    );
    box.replaceChildren(notice);
    state.resolve({
      ok: false,
      reason: "The visitor cancelled in this site's window. Nothing was done.",
    });
  }

  /**
   * Describe the result for the calling assistant. It leaves out what the visitor typed:
   * that stays in this site's window.
   *
   * :param done: The store's result.
   * :return: The reference and what was done.
   */
  static result(done) {
    return {
      ok: true,
      // The code and what was ordered. Never the visitor's details.
      code: done.code,
      summary: done.summary,
      totalText: done.totalText,
      delivery: done.delivery,
      payment: done.payment,
      note: "Ordered. The visitor checked it and typed their details in Grosir Mitra's window, which has now closed.",
    };
  }

  /**
   * Give the host of the calling site, for the window's text.
   *
   * :param origin: The caller's origin from the bridge, if any.
   * :return: The host, or "another site" when the origin is missing or not a URL.
   */
  static hostOf(origin) {
    try {
      return new URL(origin).host;
    } catch {
      return "situs lain";
    }
  }

  /**
   * Make an element with text and an optional class.
   *
   * :param tag: The tag name.
   * :param text: The text.
   * :param className: The class, or "" for none.
   * :return: The element.
   */
  static element(tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) {
      element.className = className;
    }
    return element;
  }

  /**
   * Make a hidden error line for one field.
   *
   * :param name: The field's name, for the line's id.
   * :return: The element.
   */
  static message(name) {
    const line = OrderWindow.element("p", "", "field-error");
    line.id = `write-${name}-error`;
    line.hidden = true;
    return line;
  }
}
