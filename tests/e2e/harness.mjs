// Shared Playwright harness: serves local folders AS their production https origins
// (route interception), so the exact published files run in a real browser, and mocks the
// OpenAI-compatible LLM router so no key or network is needed.
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".png": "image/png" };

/** sites: [{ base: "https://host/path/", dir: "/abs/dir" }] */
export async function mapSites(context, sites, log = []) {
  for (const site of sites) {
    await context.route(site.base + "**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      let rel = decodeURIComponent(url.pathname.slice(new URL(site.base).pathname.length));
      if (rel === "" || rel.endsWith("/")) rel += "index.html";
      const file = normalize(join(site.dir, rel));
      log.push({ url: req.url(), method: req.method(), origin: req.headers()["origin"] || null, auth: !!req.headers()["authorization"] });
      if (!file.startsWith(site.dir)) return route.fulfill({ status: 403, body: "no" });
      try {
        const body = await readFile(file);
        await route.fulfill({ status: 200, body, headers: { "content-type": TYPES[extname(file)] || "application/octet-stream", "access-control-allow-origin": "*" } });
      } catch {
        await route.fulfill({ status: 404, body: "not found", headers: { "access-control-allow-origin": "*" } });
      }
    });
  }
}

function sse(chunks) {
  return chunks.map((c) => "data: " + JSON.stringify(c) + "\n\n").join("") + "data: [DONE]\n\n";
}
export function textReply(text) {
  return sse([{ model: "mock-qwen", choices: [{ index: 0, delta: { role: "assistant", content: text } }] }, { model: "mock-qwen", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }]);
}
let callNo = 0;
export function toolReply(name, args) {
  callNo += 1;
  return sse([{ model: "mock-qwen", choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "call_" + callNo, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] }, { model: "mock-qwen", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }]);
}

/**
 * Mock LLM. `brain(req)` gets {system, user, last, tools, messages} and returns
 * {tool, args} or {text}. Every request is recorded with its Authorization header.
 */
export async function mockLlm(context, brain, calls = [], routerBase = "https://api.otari.ai/api/v1") {
  await context.route(routerBase + "/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (!req.url().endsWith("/chat/completions")) return route.fulfill({ status: 200, body: JSON.stringify({ data: [{ id: "alibaba/qwen3.8-flash" }] }), headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
    const body = JSON.parse(req.postData() || "{}");
    const msgs = body.messages || [];
    const system = msgs.filter((m) => m.role === "system").map((m) => String(m.content)).join("\n");
    const user = [...msgs].reverse().find((m) => m.role === "user");
    const info = { system, user: user ? String(user.content) : "", last: msgs[msgs.length - 1], tools: (body.tools || []).map((t) => t.function.name), toolDefs: body.tools || [], messages: msgs, auth: req.headers()["authorization"] || null, pageUrl: req.frame()?.url?.() };
    calls.push(info);
    let out;
    try { out = brain(info); } catch (e) { out = { text: "MOCK ERROR " + e.message }; }
    const payload = out.tool ? toolReply(out.tool, out.args) : textReply(out.text);
    await route.fulfill({ status: 200, body: payload, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" } });
  });
}

/** Saves a BYOK profile before any page script runs (as if the visitor pasted a key). */
export async function presetKey(context, key = "otk_mock_test_key_0000", router = "https://api.otari.ai/api/v1", model = "alibaba/qwen3.8-flash") {
  await context.addInitScript(([key, router, model]) => {
    if (!localStorage.getItem("nsweb-byok-profiles-v1")) {
      const now = new Date().toISOString();
      localStorage.setItem("nsweb-byok-profiles-v1", JSON.stringify({ version: 1, selectedId: "p1", updatedAt: now, profiles: [{ id: "p1", name: "Mock", key, router, model, updatedAt: now }] }));
    }
  }, [key, router, model]);
}

/** Last tool result in the messages, parsed. */
export function lastToolResult(info) {
  const m = info.last;
  if (!m || m.role !== "tool") return null;
  try { return JSON.parse(m.content); } catch { return m.content; }
}
