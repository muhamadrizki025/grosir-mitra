// Allow a Kasbon Warung hosted somewhere else to place orders through the bridge window.
//   node scripts/set-caller-origin.mjs https://muhamadrizki025.github.io [more origins...]
// Reads (price list, quote) are public ("*"); only the order window is restricted.
import { readFile, writeFile } from "node:fs/promises";
const origins = process.argv.slice(2).map((o) => new URL(o).origin);
if (!origins.length) { console.error("Usage: node scripts/set-caller-origin.mjs <origin> [...]"); process.exit(2); }
const p = "bridge/write-window.js";
const src = await readFile(p, "utf8");
const out = src.replace(/static CALLERS = \[[\s\S]*?\];/, `static CALLERS = [\n${origins.map((o) => `    ${JSON.stringify(o)},`).join("\n")}\n  ];`);
await writeFile(p, out);
console.log("Order window callers:", origins.join(", "));
