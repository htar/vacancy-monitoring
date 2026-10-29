import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../src/database.js";
import { flush } from "../src/scanner.js";
import type { Vacancy } from "../src/types.js";

test("flush sends pending vacancies once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vacancy-monitor-"));
  const store = new Store(join(dir, "test.sqlite"));
  const vacancy: Vacancy = { id: "1", title: "Developer", company: "Acme", location: "Remote",
    countryCode: "UA", description: "React", tags: [], employmentType: "full-time", remote: true,
    postedAt: new Date().toISOString(), source: "dou", url: "https://example.com/1" };
  try {
    store.saveVacancy(vacancy);
    const sent: string[] = [];
    assert.deepEqual(await flush(store, async (v) => { sent.push(v.id); }), { sent: 1, failed: 0 });
    assert.deepEqual(await flush(store, async () => {}), { sent: 0, failed: 0 });
    assert.deepEqual(sent, ["1"]);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
