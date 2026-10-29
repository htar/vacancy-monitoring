import type { Vacancy, WorkFormat } from "./types.js";

export const SOURCE_IDS = ["workua", "dou", "djinni", "linkedin", "bebee", "levelsfyi", "greenhouse"] as const;
export type SourceId = typeof SOURCE_IDS[number];

export interface SearchFilters {
  search: string[];
  exclude: string[];
  countryCode: string;
  workFormat: WorkFormat;
  postedWithinDays: number;
  minSalaryUsd: number;
  sources: SourceId[];
}

const rates: Record<string, number> = { USD: 1, UAH: 41, EUR: 0.93, GBP: 0.79, PLN: 4, CAD: 1.39 };
export function salaryUsd(v: Vacancy): number | undefined {
  const value = v.salaryTo ?? v.salaryFrom;
  return value ? Math.round(value / (rates[v.currency ?? "USD"] ?? 1)) : undefined;
}

export function matchesFilters(v: Vacancy, f: SearchFilters, now = new Date()): boolean {
  const text = `${v.title} ${v.company} ${v.description} ${v.tags.join(" ")}`.toLowerCase();
  if (f.search.length && !f.search.some((term) => text.includes(term.toLowerCase()))) return false;
  if (f.exclude.some((term) => text.includes(term.toLowerCase()))) return false;
  if (f.countryCode && v.countryCode && v.countryCode !== f.countryCode) return false;
  if (f.workFormat === "remote" && !v.remote) return false;
  if (f.workFormat === "onsite" && v.remote) return false;
  if (f.postedWithinDays && new Date(v.postedAt).getTime() < now.getTime() - f.postedWithinDays * 86_400_000) return false;
  const usd = salaryUsd(v);
  if (f.minSalaryUsd && (!usd || usd < f.minSalaryUsd)) return false;
  return true;
}
