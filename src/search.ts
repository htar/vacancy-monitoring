import type { Vacancy, WorkFormat } from "./types.js";

export const SOURCE_IDS = ["workua", "dou", "djinni", "linkedin", "bebee", "levelsfyi", "greenhouse",
  "jobicy", "arbeitnow", "remoteok", "wwr"] as const;
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

/** Причина, з якої вакансія не пройшла фільтри; undefined — вакансія підходить. */
export function rejectReason(v: Vacancy, f: SearchFilters, now = new Date()): string | undefined {
  const text = `${v.title} ${v.company} ${v.description} ${v.tags.join(" ")}`.toLowerCase();
  if (f.search.length && !f.search.some((term) => text.includes(term.toLowerCase()))) return "немає ключових слів";
  const excluded = f.exclude.find((term) => text.includes(term.toLowerCase()));
  if (excluded) return `містить «${excluded}»`;
  if (f.countryCode && v.countryCode && v.countryCode !== f.countryCode) return `країна не ${f.countryCode}`;
  if (f.workFormat === "remote" && !v.remote) return "не віддалено";
  if (f.workFormat === "onsite" && v.remote) return "віддалено, а потрібен офіс";
  if (f.postedWithinDays && new Date(v.postedAt).getTime() < now.getTime() - f.postedWithinDays * 86_400_000)
    return `старше ${f.postedWithinDays} дн.`;
  const usd = salaryUsd(v);
  if (f.minSalaryUsd && !usd) return "зарплата не вказана";
  if (f.minSalaryUsd && usd! < f.minSalaryUsd) return `зарплата нижча за ${f.minSalaryUsd} USD`;
  return undefined;
}

export function matchesFilters(v: Vacancy, f: SearchFilters, now = new Date()): boolean {
  return rejectReason(v, f, now) === undefined;
}
