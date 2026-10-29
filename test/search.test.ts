import test from "node:test";
import assert from "node:assert/strict";
import { matchesFilters, salaryUsd, type SearchFilters } from "../src/search.js";
import type { Vacancy } from "../src/types.js";

const vacancy: Vacancy = { id: "1", title: "Frontend React Developer", company: "Acme",
  location: "Ukraine", countryCode: "UA", description: "TypeScript", tags: ["react"],
  salaryFrom: 82000, currency: "UAH", employmentType: "full-time", remote: true,
  postedAt: new Date().toISOString(), source: "workua", url: "https://example.com/1" };
const filters: SearchFilters = { search: ["react"], exclude: [], countryCode: "UA", workFormat: "remote",
  postedWithinDays: 7, minSalaryUsd: 1500, sources: ["workua"] };

test("matches configurable vacancy filters and converts salary", () => {
  assert.equal(salaryUsd(vacancy), 2000);
  assert.equal(matchesFilters(vacancy, filters), true);
  assert.equal(matchesFilters(vacancy, { ...filters, search: ["python"] }), false);
  assert.equal(matchesFilters(vacancy, { ...filters, exclude: ["acme"] }), false);
  assert.equal(matchesFilters(vacancy, { ...filters, countryCode: "PL" }), false);
  assert.equal(matchesFilters(vacancy, { ...filters, workFormat: "onsite" }), false);
  assert.equal(matchesFilters(vacancy, { ...filters, minSalaryUsd: 3000 }), false);
  assert.equal(matchesFilters({ ...vacancy, postedAt: "2020-01-01" }, filters), false);
});
