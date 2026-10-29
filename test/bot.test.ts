import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TelegramBot } from "../src/bot.js";
import { Store } from "../src/database.js";
import type { SearchFilters } from "../src/search.js";

const originalFetch = globalThis.fetch;
const response = (result: unknown) => new Response(JSON.stringify({ ok: true, result }),
  { headers: { "content-type": "application/json" } });

test("authorized Telegram commands update and persist search filters", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vacancy-bot-"));
  const store = new Store(join(dir, "test.sqlite"));
  const filters: SearchFilters = { search: ["react"], exclude: [], countryCode: "UA", workFormat: "any",
    postedWithinDays: 7, minSalaryUsd: 0, sources: ["dou", "workua"] };
  const channels = ["junior_dou_ua"];
  const bot = new TelegramBot("token", "42", async () =>
    ({ fetched: 5, matched: 2, added: 1, failedSources: [] }), channels);
  const texts = ["/search vue, typescript", "/exclude senior", "/country off", "/format remote",
    "/days 14", "/salary 2000", "/source off workua", "/tgchannel add @frontend_dou",
    "/tgchannel remove @junior_dou_ua", "/tgchannels", "/filters", "/scan", "/status"];
  const sent: string[] = [];
  let polls = 0;
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    const body = JSON.parse(String(init?.body));
    if (method === "getUpdates") {
      polls += 1;
      if (polls === 1) return response(texts.map((text, index) =>
        ({ update_id: index + 1, message: { chat: { id: 42 }, text } })));
      bot.stop(); return response([]);
    }
    sent.push(String(body.text)); return response(true);
  };
  try {
    await bot.run(store, filters);
    assert.deepEqual(filters.search, ["vue", "typescript"]);
    assert.deepEqual(filters.exclude, ["senior"]);
    assert.equal(filters.countryCode, "");
    assert.equal(filters.workFormat, "remote");
    assert.equal(filters.postedWithinDays, 14);
    assert.equal(filters.minSalaryUsd, 2000);
    assert.deepEqual(filters.sources, ["dou"]);
    assert.deepEqual(channels, ["frontend_dou"]);
    assert.equal(store.getSetting("telegram_channels"), '["frontend_dou"]');
    assert.deepEqual(store.loadFilters(), filters);
    assert.ok(sent.some((text) => text.includes("Перевірено: 5")));
  } finally {
    globalThis.fetch = originalFetch; store.close(); rmSync(dir, { recursive: true, force: true });
  }
});
