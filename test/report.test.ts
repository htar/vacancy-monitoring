import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../src/database.js";
import { formatReport, isReportDue, localDate, previousDate } from "../src/report.js";
import { rejectReason, type SearchFilters } from "../src/search.js";
import type { Vacancy } from "../src/types.js";

const base: Vacancy = { id: "1", title: "React Developer", company: "Acme", location: "Kyiv",
  countryCode: "UA", description: "", tags: [], employmentType: "full-time", remote: false,
  postedAt: new Date().toISOString(), source: "dou", url: "https://example.com/1" };
const filters: SearchFilters = { search: ["react"], exclude: ["senior"], countryCode: "UA", workFormat: "any",
  postedWithinDays: 7, minSalaryUsd: 0, sources: ["dou"] };

test("rejectReason explains why a vacancy was filtered out", () => {
  assert.equal(rejectReason(base, filters), undefined);
  assert.equal(rejectReason({ ...base, title: "Python Developer" }, filters), "немає ключових слів");
  assert.equal(rejectReason({ ...base, title: "Senior React Developer" }, filters), "містить «senior»");
  assert.equal(rejectReason({ ...base, countryCode: "PL" }, filters), "країна не UA");
  assert.equal(rejectReason(base, { ...filters, workFormat: "remote" }), "не віддалено");
  assert.equal(rejectReason(base, { ...filters, minSalaryUsd: 1000 }), "зарплата не вказана");
});

test("collects daily stats per report period", () => {
  const dir = mkdtempSync(join(tmpdir(), "vacancy-report-"));
  const store = new Store(join(dir, "test.sqlite"));
  try {
    const matchedA = { ...base, id: "a", salaryFrom: 2000, currency: "USD" };
    const matchedB = { ...base, id: "b", salaryFrom: 3000, currency: "USD" };
    const matchedC = { ...base, id: "c" };
    store.recordSeen(matchedA, undefined);
    store.recordSeen(matchedA, undefined); // повторний скан не дублює
    store.recordSeen(matchedB, undefined);
    store.recordSeen(matchedC, undefined);
    store.recordSeen({ ...base, id: "d" }, "країна не UA");
    store.recordSeen({ ...base, id: "e" }, "країна не UA");
    store.recordSeen({ ...base, id: "f" }, "немає ключових слів");
    store.saveVacancy(matchedA);
    store.markNotified(matchedA);
    const now = new Date();
    store.recordSeen({ ...base, id: "y" }, undefined, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12));

    const stats = store.reportStats(localDate(now));
    assert.equal(stats.seen, 6);
    assert.equal(stats.matched, 3);
    assert.equal(stats.sent, 1);
    assert.equal(stats.avgSalaryUsd, 2500);
    assert.equal(stats.withSalary, 2);
    assert.deepEqual(stats.topReasons, [{ reason: "країна не UA", count: 2 }, { reason: "немає ключових слів", count: 1 }]);

    const text = formatReport(stats, "Підсумок за 2026-10-29");
    assert.match(text, /Переглянуто: 6\nЗбігів: 3\nНадіслано: 1/);
    assert.match(text, /Середня зарплата збігів: 2.500 USD \(вказана в 2 з 3\)/);
    assert.match(text, /• країна не UA \(2\)/);

    const yesterday = store.reportStats(previousDate(now));
    assert.equal(yesterday.seen, 1);
    assert.equal(yesterday.matched, 1);
    store.pruneSeenLog(new Date(now.getTime() + 15 * 86_400_000));
    assert.equal(store.reportStats(localDate(now)).seen, 0);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("morning report is due once a day and covers the previous day", () => {
  const morning = new Date(2026, 10, 1, 7, 0);
  assert.equal(localDate(morning), "2026-11-01");
  assert.equal(previousDate(morning), "2026-10-31");
  assert.equal(isReportDue(new Date(2026, 10, 1, 6, 59), 7, undefined), false);
  assert.equal(isReportDue(morning, 7, "2026-10-31"), true);
  assert.equal(isReportDue(morning, 7, "2026-11-01"), false);
});
