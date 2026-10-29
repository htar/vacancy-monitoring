import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../src/database.js";
import type { Vacancy } from "../src/types.js";
import type { SearchFilters } from "../src/search.js";

const vacancy: Vacancy = { id: "1", title: "Developer", company: "Acme", location: "Remote",
  countryCode: "UA", description: "React", tags: [], employmentType: "full-time", remote: true,
  postedAt: new Date().toISOString(), source: "dou", url: "https://example.com/1" };

test("persists settings and provides a retryable delivery queue", () => {
  const dir = mkdtempSync(join(tmpdir(), "vacancy-monitor-"));
  const store = new Store(join(dir, "test.sqlite"));
  try {
    const filters: SearchFilters = { search: ["react"], exclude: [], countryCode: "UA", workFormat: "any",
      postedWithinDays: 7, minSalaryUsd: 0, sources: ["dou"] };
    store.saveFilters(filters);
    assert.deepEqual(store.loadFilters(), filters);
    assert.equal(store.getSetting("baseline_created"), undefined);
    store.setSetting("baseline_created", "true");
    assert.equal(store.getSetting("baseline_created"), "true");
    assert.equal(store.saveVacancy(vacancy), true);
    assert.equal(store.saveVacancy(vacancy), false);
    assert.equal(store.pending().length, 1);
    store.markFailed(vacancy, new Error("offline"));
    assert.equal(store.pending().length, 0);
    assert.equal(store.markAllPendingNotified(), 1);
    store.markNotified(vacancy);
    assert.deepEqual(store.stats(), { processed: 1, notified: 1, pending: 0 });
    assert.equal(store.saveFavorite(vacancy), true);
    assert.equal(store.saveFavorite(vacancy), false);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
