import type { Vacancy } from "./types.js";
import type { SearchFilters } from "./search.js";
import { matchesFilters } from "./search.js";
import { fetchVacancies } from "./providers/index.js";
import type { Store } from "./database.js";

export interface ScanSummary { fetched: number; matched: number; added: number; failedSources: string[]; }

export async function scan(store: Store, filters: SearchFilters): Promise<ScanSummary> {
  const all: Vacancy[] = [];
  const failed = new Set<string>();
  for (const query of filters.search.length ? filters.search : [""]) {
    const result = await fetchVacancies(filters.sources, query, filters.countryCode);
    all.push(...result.vacancies);
    result.failed.forEach((source) => failed.add(source));
  }
  const unique = new Map(all.map((v) => [`${v.source}:${v.id}`, v]));
  let matched = 0;
  let added = 0;
  for (const vacancy of unique.values()) {
    if (!matchesFilters(vacancy, filters)) continue;
    matched += 1;
    if (store.saveVacancy(vacancy)) added += 1;
  }
  return { fetched: unique.size, matched, added, failedSources: [...failed] };
}

export async function flush(store: Store, send: (v: Vacancy) => Promise<void>) {
  let sent = 0; let failed = 0;
  for (const vacancy of store.pending()) {
    try { await send(vacancy); store.markNotified(vacancy); sent += 1; }
    catch (error) { store.markFailed(vacancy, error); failed += 1; }
  }
  return { sent, failed };
}
