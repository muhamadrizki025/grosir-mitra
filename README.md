# Grosir Mitra — agen sembako (Open Agentic Web partner site)

**Live:** https://muhamadrizki025.github.io/grosir-mitra/
**Agent network URL:** `https://muhamadrizki025.github.io/grosir-mitra/agen_grosir`

A small (demo) staple-goods wholesaler in Karawang whose agent other agentic websites can call —
built as the partner of [Buku Bon Agentik](https://github.com/muhamadrizki025/buku-bon-agentik)
for the [Open Agentic Web Challenge](https://cognizant-agenticweb.devpost.com/).
**Prices are sample figures for the demo, not a real offer.**

## What it offers

- **Page:** price list, live restock calculator (subtotal, delivery fee, delivery day with a
  14:00 WIB cut-off and no Sunday delivery), cash-on-delivery order form. Works without AI.
- **Agent network** `agen_grosir` (one agent, [`agen_grosir.hocon`](agen_grosir.hocon) →
  [`agen_grosir.network.json`](agen_grosir.network.json)), browser runtime in [`runtime/`](runtime/),
  BYOK settings (OpenRouter / Otari / any OpenAI-compatible router).
- **Site actions on its own page** ([`site-actions.js`](site-actions.js)): `get_price_list` (read),
  `quote_restock` (read), `place_restock_order` (irreversible → confirmation dialog).
- **Shared with other agent sites** ([`bridge/bridge-actions.js`](bridge/bridge-actions.js)):
  - `get_price_list`, `quote_restock` — public facts, `callerOrigins: ["*"]`, run in a hidden frame on this origin;
  - `order_restock` — a write that opens **Grosir Mitra's own window** ([`bridge/write-window.js`](bridge/write-window.js)),
    where the warung owner checks the order and types her name, WhatsApp and address. The calling
    chat gets only the order code and summary. Allowed only for `https://muhamadrizki025.github.io`
    (Buku Bon Agentik); input schema is items + quantities only.

## Calling it from your own agentic site

Add `https://muhamadrizki025.github.io/grosir-mitra/agen_grosir` to an agent's `tools`, its origin to
`allowed_peers`, and a `link_labels` entry. Your visitor's browser runs this network on your visitor's
key. Ask with item names and quantities (e.g. “Harga 3 dus minyak goreng 2 L dan kapan diantar?”).
Never send customer names or phone numbers.

## ⚠ Origin note

Both demo sites currently live on `muhamadrizki025.github.io` (one origin), so a call from Buku Bon
Agentik shows no consent card and the two sites share storage. The intended deployment is a second
origin such as Cloudflare Pages (`grosir-mitra.pages.dev`); after moving, run
`node scripts/set-caller-origin.mjs https://muhamadrizki025.github.io` here (already the default) and
`node scripts/set-partner-origin.mjs https://grosir-mitra.pages.dev/` in the warung repo.

## Build & test

```sh
npm run build   # hocon -> network.json, bridge + discovery files, runtime validation
npm run check
npm test        # pricing boundaries, delivery-day rules, orders, actions vs manifest, bridge sharing, network validation
```

The cross-site Playwright smoke test lives in the warung repo (`tests/e2e/smoke.mjs`); see `tests/e2e/README.md`.

MIT (own code); `runtime/` and `tools/agentify-website/` are Apache-2.0 from cognizant-ai-labs/agentic-web — see [LICENSE](LICENSE).
