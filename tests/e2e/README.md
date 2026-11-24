# End-to-end smoke test

The cross-site smoke test (warung → Grosir Mitra, same-origin and cross-origin variants,
plus this site on its own) lives in the warung repo, because it drives both sites:
https://github.com/muhamadrizki025/buku-bon-agentik/blob/main/tests/e2e/smoke.mjs

Clone both repos side by side, then in `buku-bon-agentik/tests/e2e`:

```sh
npm install && npx playwright install chromium
GROSIR_DIR=../../../grosir-mitra node smoke.mjs
```

`harness.mjs` here is the same helper (route-mapped origins + mock OpenAI-compatible LLM).
